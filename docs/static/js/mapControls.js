// UI wiring and event listeners

//////////////////////////////////////////////////////////

// create dropdown for town interaction
function initializeTownsDropdown() {
  const controlDiv = document.getElementById("towns-control");
  const dropdown = createTownsDropdown();
  controlDiv.appendChild(dropdown);

  // create towns layer but don't add it to the map yet
  mapState.choroplethLayer = initializeChoroplethLayer();
}

// create town dropdown elements
function createTownsDropdown() {
  const dropdown = document.createElement("select");
  dropdown.id = "towns-dropdown";

  // sort towns alphabetically
  const sortedFeatures = [...towns.features].sort((a, b) =>
    a.properties.town_name.localeCompare(b.properties.town_name),
  );

  // populate dropdown menu, VT first, then sorted towns
  const allVT = createOption("State of Vermont", "top");
  dropdown.appendChild(allVT);
  sortedFeatures.forEach((feature) => {
    const option = createOption(
      feature.properties.town_name,
      feature.properties.town_name,
    );
    option.setAttribute("aria-label", `Town: ${feature.properties.town_name}`);
    dropdown.appendChild(option);
  });

  return dropdown;
}

// create dropdown options
function createOption(text, value) {
  const option = document.createElement("option");
  option.text = text;
  option.value = value;
  return option;
}

//////////////////////////////////////////////////////////

// setup event listeners, mostly for UI controls
function initializeUIControls() {
  wireTownsDropdown();
  wireChoroplethButtons();
  wireRelativeToggle();
  wireModelControls();
  wireMapZoomLabelToggle();
  wireRiverCorridorsTier2();
}

// event listener for town dropdown changes to update map and other components
function wireTownsDropdown() {
  const dropdown = document.getElementById("towns-dropdown");
  // safety check
  if (!dropdown) return;

  // event listener for dropdown changes
  dropdown.addEventListener("change", (e) => {
    const selected = e.target.value;

    // update selected town in mapState and dashboard components
    mapState.selectedTown = selected;
    updateDashboard();

    // change map view based on selected town
    if (selected === "top") {
      resetMapView();
    } else {
      zoomIn();
    }
  });
}

// setup event listeners for choropleth overlay buttons and toggle active class for buttons
function wireChoroplethButtons() {
  const containers = [
    document.getElementById("choropleth-control"),
    document.getElementById("choropleth-control-secondary"),
    document.getElementById("choropleth-control-special"),
    document.getElementById("context-controls"),
  ].filter(Boolean);

  // set initial active button on load
  syncChoroplethButtons("Quadrants");

  // event listener for choropleth changes
  containers.forEach((container) => {
    container.addEventListener("click", (e) => {
      const selectedOverlay = e.target.getAttribute("data-overlay");
      if (!selectedOverlay) return;

      // update map based on selected overlay
      mapState._activeOverlay = selectedOverlay;
      handleOverlaySelection(selectedOverlay);
      syncChoroplethButtons(selectedOverlay);
      updateOverlayDefinition();
      updateModelDefinition();
      updateClaimsBenchmarkNote();
    });
  });
}

// event listener for toggle slider changes and styling of toggle labels
function wireRelativeToggle() {
  const toggles = [
    document.getElementById("toggle-relative"),
    document.getElementById("toggle-relative-secondary"),
  ].filter(Boolean);

  // set initial state of toggle labels
  updateToggleLabels();

  // event listener for toggle changes
  toggles.forEach((toggle) => {
    toggle.addEventListener("change", (e) => {
      // set relative mode in mapState and metricEngine based on toggle state
      mapState.isRelative = e.target.checked;
      metricEngine.isRelative = mapState.isRelative;

      // update choropleth metric to trigger style and legend updates
      updateDashboard();

      // sync both sliders
      toggles.forEach((t) => {
        t.checked = mapState.isRelative;
      });
      updateToggleLabels();
    });
  });
}

// setup event listener for model scheme changes and toggle active class for buttons
function wireModelControls() {
  const containers = [
    document.getElementById("model-selector-group"),
    document.getElementById("model-selector-group-secondary"),
  ].filter(Boolean);

  // sync model buttons to Risk per Person on load
  function syncModelGroups(scheme) {
    containers.forEach((container) => {
      // remove active status from all buttons in the group
      container.querySelectorAll("label").forEach((label) => {
        label.classList.remove("active");
        label.setAttribute("aria-pressed", "false");
      });
      // set active button based on selected scheme
      container.querySelectorAll("input[type=radio]").forEach((input) => {
        if (input.getAttribute("data-overlay") === scheme) {
          input.checked = true;
          input.parentElement.classList.add("active");
          input.parentElement.setAttribute("aria-pressed", "true");
        }
      });
    });
  }

  syncModelGroups("Risk per Person");

  containers.forEach((container) => {
    container.addEventListener("change", (e) => {
      const scheme = e.target.getAttribute("data-overlay");
      if (!scheme) return;

      // sync all model control groups to reflect the newly chosen model
      syncModelGroups(scheme);

      // update model in mapState and metricEngine, update choropleth and other components
      mapState.model = modelLabels[scheme] ?? "eal_per_capita"; // default to EAL per capita, modelLabels in config.js maps from label to key
      metricEngine.model = mapState.model;
      updateDashboard();

      // disable Risk and Vulnerability buttons when NRI model is active (NRI score already embeds SOVI)
      updateNRIModelUI(scheme === "FEMA Risk Index");
    });
  });
}

// disable risk/vulnerability choropleth buttons and show note when NRI model is active
// if an incompatible overlay is currently active, auto-switch to Gap
function updateNRIModelUI(isNri) {
  const note = document.getElementById("nri-model-note");

  // derive overlay labels from config.js and toggle all matching buttons across every container
  nriBlockedMetrics.forEach((metric) => {
    const label = baseToOverlay[metric];
    if (!label) return;
    document.querySelectorAll(`[data-overlay="${label}"]`).forEach((btn) => {
      btn.disabled = isNri;
      btn.title = isNri
        ? "Not available for NRI model — NRI Risk Score already includes social vulnerability"
        : "";
    });
  });

  if (note) note.style.display = isNri ? "block" : "none";

  // if NRI is now active and an incompatible overlay is selected, switch to Gap
  if (isNri && nriBlockedMetrics.includes(metricEngine.baseMetric)) {
    const fallback = baseToOverlay["gap"];
    handleOverlaySelection(fallback);
    syncChoroplethButtons(fallback);
  }
}

// toggle choropleth labels based on zoom level to avoid visual clutter
function wireMapZoomLabelToggle() {
  applyZoomLabelVisibility(); // apply on init
  mapState.map.on("zoomend", applyZoomLabelVisibility);
}

// swap between tier 1 (simplified) and tier 2 (detailed) river corridors based on zoom level
// tier 2 is lazy-loaded on the first zoom-in to level 11+
function wireRiverCorridorsTier2() {
  // tier2Features: precomputed array of {feature, bbox: [minX, minY, maxX, maxY]}
  let tier2Features = null;
  let tier2Loading = false;

  // compute flat bbox from any Polygon or MultiPolygon feature
  function bboxOf(feature) {
    // flatten all coordinates to a single array of [x, y] pairs, then compute min/max for x and y
    const flat = feature.geometry.coordinates.flat(Infinity);
    // initialize min/max with the first coordinate pair (any real lat/long immediately replaces +/-Infinity)
    let minX = Infinity, // West
      minY = Infinity, // South
      maxX = -Infinity, // East
      maxY = -Infinity; // North
    // loop to find min/max
    for (let i = 0; i < flat.length; i += 2) {
      if (flat[i] < minX) minX = flat[i];
      if (flat[i + 1] < minY) minY = flat[i + 1];
      if (flat[i] > maxX) maxX = flat[i];
      if (flat[i + 1] > maxY) maxY = flat[i + 1];
    }
    return [minX, minY, maxX, maxY];
  }

  // build (or rebuild) the tier 2 layer from only the features that intersect the current viewport
  function buildViewportLayer() {
    // safety check
    if (!tier2Features) return;

    // get current viewport bounds
    const b = mapState.map.getBounds();
    const vW = b.getWest(),
      vS = b.getSouth(),
      vE = b.getEast(),
      vN = b.getNorth();

    // filter tier 2 features to those that intersect the viewport bbox, using precomputed bboxes for performance
    const inView = tier2Features
      .filter(
        // only exclude features that are completely outside the viewport
        ({ bbox: [minX, minY, maxX, maxY] }) =>
          maxX >= vW && minX <= vE && maxY >= vS && minY <= vN,
      )
      .map(({ feature }) => feature);

    // remove previous viewport layer
    if (mapState.riverCorridorsTier2Layer) {
      mapState.map.removeLayer(mapState.riverCorridorsTier2Layer);
      mapState.riverCorridorsTier2Layer = null;
    }

    // safety check
    if (inView.length === 0) return;

    // build and add new layer
    mapState.riverCorridorsTier2Layer = initializeRiverCorridorsLayer(
      {
        type: "FeatureCollection",
        features: inView,
      },
      2,
    );
    mapState.riverCorridorsTier2Layer.addTo(mapState.map);
  }

  // hide tier 1 and render only in-viewport tier 2 features
  function activateTier2() {
    if (mapState.riverCorridorsLayer) {
      mapState.map.removeLayer(mapState.riverCorridorsLayer);
    }
    buildViewportLayer();
  }

  mapState.map.on("zoomend moveend", () => {
    const zoom = mapState.map.getZoom();

    if (zoom >= ZOOM_RIVER_DETAIL) {
      if (!tier2Features && !tier2Loading) {
        // first zoom-in: lazy-load once, then precompute bboxes
        tier2Loading = true;
        fetch("./static/resources/river_corridors_tier2.geojson")
          .then((r) => r.json())
          .then((data) => {
            tier2Features = data.features.map((feature) => ({
              feature,
              bbox: bboxOf(feature),
            }));
            tier2Loading = false;
            activateTier2();
          });
      } else if (tier2Features) {
        // already loaded: rebuild for new viewport (pan or zoom)
        activateTier2();
      }
    } else {
      // zoomed back out: remove tier 2, restore tier 1 (only if no bubble view is active, to avoid visual clutter)
      if (mapState.riverCorridorsTier2Layer) {
        mapState.map.removeLayer(mapState.riverCorridorsTier2Layer);
        mapState.riverCorridorsTier2Layer = null;
      }
      const bubbleActive =
        (mapState.popBubbleLayer &&
          mapState.map.hasLayer(mapState.popBubbleLayer)) ||
        (mapState.fundingBubbleLayer &&
          mapState.map.hasLayer(mapState.fundingBubbleLayer));
      if (
        !bubbleActive &&
        mapState.riverCorridorsLayer &&
        !mapState.map.hasLayer(mapState.riverCorridorsLayer)
      ) {
        mapState.riverCorridorsLayer.addTo(mapState.map);
      }
    }
  });
}

/////////////////////////////////////////////////////////////

// helpers for event listeners and UI state management

// syncs active state of choropleth buttons for consistent UI feedback across multiple button groups
function syncChoroplethButtons(selectedOverlay) {
  const allButtons = document.querySelectorAll(
    "#choropleth-control button, #choropleth-control-secondary button, #choropleth-control-special button, #context-controls button",
  );

  allButtons.forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.getAttribute("data-overlay") === selectedOverlay,
    );
  });
}

// style toggle slider labels based on state
function updateToggleLabels() {
  const absoluteLabels = document.querySelectorAll(".absolute-label");

  absoluteLabels.forEach((label) => {
    if (mapState.isRelative) {
      label.classList.remove("active");
    } else {
      label.classList.add("active");
    }
  });
}

// toggle choropleth labels based on zoom level to avoid visual clutter
function applyZoomLabelVisibility() {
  const zoom = mapState.map.getZoom();
  const popBubbleActive =
    mapState.popBubbleLayer && mapState.map.hasLayer(mapState.popBubbleLayer);
  const fundBubbleActive =
    mapState.fundingBubbleLayer &&
    mapState.map.hasLayer(mapState.fundingBubbleLayer);
  const quadrantActive =
    mapState.quadrantLayer && mapState.map.hasLayer(mapState.quadrantLayer);

  // these views have no text labels — suppress everything
  if (quadrantActive || mapState.riverCorridorsFocused) {
    if (mapState.choroplethLabels)
      mapState.map.removeLayer(mapState.choroplethLabels);
    if (mapState.popBubbleLabels)
      mapState.map.removeLayer(mapState.popBubbleLabels);
    if (mapState.fundingBubbleLabels)
      mapState.map.removeLayer(mapState.fundingBubbleLabels);
    return;
  }

  // determine active label layer
  const activeLabels = popBubbleActive
    ? mapState.popBubbleLabels
    : fundBubbleActive
      ? mapState.fundingBubbleLabels
      : mapState.choroplethLabels;

  // hide all other label layers
  [
    mapState.popBubbleLabels,
    mapState.fundingBubbleLabels,
    mapState.choroplethLabels,
  ].forEach((layer) => {
    if (layer && layer !== activeLabels) mapState.map.removeLayer(layer);
  });

  // show active labels only if zoomed in enough
  if (activeLabels) {
    if (zoom >= ZOOM_LABELS) {
      activeLabels.addTo(mapState.map);
    } else {
      mapState.map.removeLayer(activeLabels);
    }
  }
}
