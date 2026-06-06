// Abandoned start of a refactor to centralize map overlay management.
// Basically, instead of hardcoding behavior for each overlay in the event handler, we define a registry of overlay objects...
// ...that encapsulate their own activate/deactivate/update logic.
// From procedural if/else statements to a more modular, object-oriented approach.
// This makes it easier to add new overlays in the future without modifying core event handling code.

// Someday/Maybe solution to current technical debt around the spaghetti of map overlay logic in handleOverlaySelection and updateMetric
// The idea would be to make simplify things like popup and legend management by co-locating them with the overlay definitions

// First, the new handleOverlaySelection function
// then all new code to support it (overlay registry, manager functions, and refactored built-in overlays)
// (replaces the previous hardcoded logic for quadrants, population, funding, river corridors, and choropleth overlays)
// Finally, a small addition of error handling in updateMetric to prevent any issues in custom overlay update logic from breaking the rest of the metric update flow

// TODO:
// Switching between choropleths locks up the dashboard on zoom (a town)
// Root cause: unintentional recursion between updateMetric() and the choropleth adapter's update():
// updateMetric() now calls the active overlay's update() at end (map.js:1216-1236).
// choroplethOverlay.update() simply calls updateMetric() when the choropleth layer is present (map.js:856-860).
// That creates a recursive loop: updateMetric() → choroplethOverlay.update() → updateMetric() → ... which will hang or blow the call stack when the choropleth overlay is active (exactly the situation you described: switching into choropleth while zoomed / town context triggers updateMetric()).
// TODO:
// Option A (fast, low-risk): Remove/neutralize the choroplethOverlay.update() implementation so it does not call updateMetric() (i.e., make it a no-op). That breaks the recursion immediately because updateMetric() -> overlay.update() will no longer re-enter updateMetric()



// refactored version of handleOverlaySelection
// replaces the previous hardcoded if/else logic with a more flexible overlay registry and manager

// change map overlay based on selected option
function handleOverlaySelection(selectedOverlay) {
  if (!selectedOverlay) return;
  activateOverlayByName(selectedOverlay);
}

// function handleOverlaySelection(selectedOverlay) {
//   // safety check
//   if (!selectedOverlay) return;

//   // reset all layers and states before activating the new overlay
//   resetOverlayState();

//   // conditional logic for each overlay type
//   if (selectedOverlay === "Population") togglePopBubbleLayer();
//   else if (selectedOverlay === "Funding Bubble") toggleFundingBubbleLayer();
//   else if (selectedOverlay === "Quadrants") toggleQuadrantLayer();
//   else if (selectedOverlay === "River Corridors")
//     toggleRiverCorridorsFocusView();
//   else {
//     // choropleth overlays
//     metricEngine.baseMetric = metricEngine.overlayToBase[selectedOverlay];
//     updateDashboard();
//   }

//   // for choropleth-quadrant popup persistence
//   reopenLockedPopup(selectedOverlay);
// }

/////////////////////////////////////////////////////////////

// new code for centralized overlay management

// Overlay registry and simple manager
const overlayRegistry = {};

function registerOverlay(name, overlayObj) {
  overlayRegistry[name] = overlayObj;
}

function getOverlay(name) {
  return overlayRegistry[name];
}

function activateOverlayByName(name) {
  if (!name) return;
  // reset shared state first (same as previous behavior)
  resetOverlayState();

  // set active overlay early so overlay.activate can read it
  mapState._activeOverlay = name;

  const overlay = getOverlay(name);
  if (overlay && typeof overlay.activate === "function") {
    try {
      overlay.activate(name);
    } catch (err) {
      console.error("Error activating overlay", name, err);
    }
  } else {
    // fallback to legacy choropleth behavior when no overlay object is registered
    if (
      metricEngine &&
      metricEngine.overlayToBase &&
      metricEngine.overlayToBase[name]
    ) {
      metricEngine.baseMetric = metricEngine.overlayToBase[name];
      updateDashboard();
    }
  }

  // preserve old behavior of reopening a locked popup after activation
  reopenLockedPopup(name);
}

// Register a few built-in overlays that delegate to existing functions.
// These are intentionally thin adapters so behavior is unchanged.
const quadrantOverlay = {
  activate() {
    if (!mapState.quadrantLayer)
      mapState.quadrantLayer = initializeQuadrantLayer();
    clearChoroplethFill();
    showLayer(mapState.quadrantLayer);
    applyZoomLabelVisibility();
    updateQuadrantLegend();
  },
  deactivate() {
    hideLayer(mapState.quadrantLayer);
  },
  update() {
    if (
      mapState.quadrantLayer &&
      mapState.map.hasLayer(mapState.quadrantLayer)
    ) {
      mapState.quadrantLayer.setStyle(mapState.quadrantLayer.options.style);
      updateQuadrantLegend();
    }
  },
};
registerOverlay("Quadrants", quadrantOverlay);

const populationOverlay = {
  activate() {
    if (!mapState.popBubbleLayer)
      mapState.popBubbleLayer = initializePopBubbleChartLayer();
    hideLayer(mapState.riverCorridorsLayer);
    showLayer(mapState.popBubbleLayer);
    clearChoroplethFill();
    mapState.choroplethLegend = addLegend("population-bubble").addTo(
      mapState.map,
    );
    applyZoomLabelVisibility();
  },
  deactivate() {
    hideLayer(mapState.popBubbleLayer);
    if (
      !mapState.riverCorridorsTier2Layer &&
      mapState.riverCorridorsLayer &&
      !mapState.map.hasLayer(mapState.riverCorridorsLayer)
    ) {
      mapState.riverCorridorsLayer.addTo(mapState.map);
    }
  },
  update() {
    // no-op for now; bubble layers re-render when their underlying data changes
  },
};
registerOverlay("Population", populationOverlay);

const fundingOverlay = {
  activate() {
    if (!mapState.fundingBubbleLayer)
      mapState.fundingBubbleLayer = initializeFundingBubbleLayer();
    hideLayer(mapState.riverCorridorsLayer);
    showLayer(mapState.fundingBubbleLayer);
    clearChoroplethFill();
    mapState.choroplethLegend = addLegend("funding-bubble").addTo(mapState.map);
    applyZoomLabelVisibility();
  },
  deactivate() {
    hideLayer(mapState.fundingBubbleLayer);
  },
  update() {},
};
registerOverlay("Funding Bubble", fundingOverlay);

const riverOverlay = {
  activate() {
    // ensure river corridors layer exists
    if (!mapState.riverCorridorsLayer) {
      mapState.riverCorridorsLayer = initializeRiverCorridorsLayer(
        riverCorridors,
        1,
      );
      mapState.riverCorridorsLayer.addTo(mapState.map);
    }
    if (!mapState.riverCorridorsFocused) toggleRiverCorridorsFocusView();
    applyZoomLabelVisibility();
  },
  deactivate() {
    if (mapState.riverCorridorsFocused) restoreRiverCorridorsDefaultStyle();
  },
  update() {},
};
registerOverlay("River Corridors", riverOverlay);

// Choropleth overlay: handles all overlay labels mapped in `overlayToBase` (config.js)
const choroplethOverlay = {
  activate(name) {
    // resolve base metric from overlay label
    const base =
      metricEngine &&
      metricEngine.overlayToBase &&
      metricEngine.overlayToBase[name];
    if (!base) {
      console.warn("Unknown choropleth overlay:", name);
      return;
    }

    // set base metric and ensure choropleth layer exists on the map
    metricEngine.baseMetric = base;
    if (!mapState.choroplethLayer)
      mapState.choroplethLayer = initializeChoroplethLayer();
    if (!mapState.map.hasLayer(mapState.choroplethLayer))
      mapState.choroplethLayer.addTo(mapState.map);

    // update choropleth visuals and related UI
    updateDashboard();
  },
  deactivate() {
    clearChoroplethFill();
    if (mapState.choroplethLegend) {
      mapState.map.removeControl(mapState.choroplethLegend);
      mapState.choroplethLegend = null;
    }
  },
  update() {
    if (mapState.map.hasLayer(mapState.choroplethLayer)) updateMetric();
  },
  getLegend() {
    return "choropleth";
  },
};

// register all choropleth labels defined in config.js
for (const label of Object.keys(overlayToBase || {})) {
  registerOverlay(label, choroplethOverlay);
}

/////////////////////////////////////////////////////////////

// only added the try/catch to this function (at the end) since it's called from updateMetric,
// which is called from the overlay manager's update() method — we want to prevent any errors in custom overlay update logic
// from breaking the rest of the metric update flow

// render choropleth based on selected metric and town
function updateMetric() {
  const quadrantActive =
    mapState.quadrantLayer && mapState.map.hasLayer(mapState.quadrantLayer);
  const bubbleActive =
    mapState.popBubbleLayer && mapState.map.hasLayer(mapState.popBubbleLayer);
  const fundingBubbleActive =
    mapState.fundingBubbleLayer &&
    mapState.map.hasLayer(mapState.fundingBubbleLayer);

  if (quadrantActive) {
    // quadrant layer is visible: re-run its own style function so selected-town highlight applies too
    mapState.quadrantLayer.setStyle(mapState.quadrantLayer.options.style);
    updateQuadrantLegend();
  } else if (
    bubbleActive ||
    fundingBubbleActive ||
    mapState.riverCorridorsFocused
  ) {
    // bubble / river layer is visible: model changed, but don't touch the choropleth or its legend
  } else {
    // choropleth is active: update metric, style, labels, legend, and hatch overlay for zero-funding towns
    const metricKey = metricEngine.getMetricKey();
    mapState.choroplethMetric = metricKey;
    mapState.choroplethLayer.options.metric = metricKey;
    mapState.choroplethLayer.setStyle(mapState.choroplethLayer.options.style);
    updateChoroplethLabels();
    updateChoroplethLegend();
    showLayer(initializeNoFundingHatchLayer());
  }

  // after any setStyle call, bring the selected town's <path> to the top of the SVG DOM
  // so its bold border renders above neighboring town borders
  if (mapState.selectedTown && mapState.selectedTown !== "top") {
    const activeLayer = quadrantActive
      ? mapState.quadrantLayer
      : mapState.choroplethLayer;
    if (activeLayer) {
      const sel = activeLayer
        .getLayers()
        .find((l) => l.feature.properties.town_name === mapState.selectedTown);
      if (sel) {
        sel.bringToFront();
        // hatch paths are in the same flat SVG — re-raise them so they stay on top of the choropleth fill
        if (
          mapState.noFundingHatchLayer &&
          mapState.map.hasLayer(mapState.noFundingHatchLayer)
        ) {
          mapState.noFundingHatchLayer.bringToFront();
        }
      }
    }
  }

  // notify active overlay to update itself (e.g., re-style bubbles, choropleth, quadrants)
  try {
    const activeOverlayObj = getOverlay(mapState._activeOverlay);
    if (activeOverlayObj && typeof activeOverlayObj.update === "function") {
      activeOverlayObj.update();
    }
  } catch (err) {
    console.error(
      "Error updating active overlay:",
      mapState._activeOverlay,
      err,
    );
  }
}
