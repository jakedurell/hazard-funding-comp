// overlay switching, dashboard updates, state transitions

/////////////////////////////////////////////////////////////

// update dashboard components based on selected metric and model

// change map overlay based on selected option
function handleOverlaySelection(selectedOverlay) {
  // safety check
  if (!selectedOverlay) return;

  // reset all layers and states before activating the new overlay
  resetOverlayState();

  // conditional logic for each overlay type
  if (selectedOverlay === "Population") togglePopBubbleLayer();
  else if (selectedOverlay === "Funding Bubble") toggleFundingBubbleLayer();
  else if (selectedOverlay === "Quadrants") toggleQuadrantLayer();
  else if (selectedOverlay === "River Corridors")
    toggleRiverCorridorsFocusView();
  else {
    // choropleth overlays
    metricEngine.baseMetric = metricEngine.overlayToBase[selectedOverlay];
    updateDashboard();
  }

  // for choropleth-quadrant popup persistence
  reopenLockedPopup(selectedOverlay);
}

// tear down all special overlays before activating a new one
function resetOverlayState() {
  hideLayer(mapState.popBubbleLayer);
  hideLayer(mapState.fundingBubbleLayer);
  hideLayer(mapState.quadrantLayer);
  hideLayer(mapState.noFundingHatchLayer); // hide hatch when leaving choropleth view
  restoreRiverCorridorsDefaultStyle();
  // restore tier 1 river corridors unless tier 2 is currently displayed
  if (!mapState.riverCorridorsTier2Layer) {
    showLayer(mapState.riverCorridorsLayer);
  }
}

// re-open the last town popup on the newly active layer after an overlay switch
function reopenLockedPopup(overlay) {
  if (!_lockedPopupTown) return;

  // non-popup overlays — clear tracking and bail
  if (["Population", "Funding Bubble", "River Corridors"].includes(overlay)) {
    _lockedPopupTown = null;
    return;
  }

  const isQuadrant = overlay === "Quadrants";
  const activeLayer = isQuadrant
    ? mapState.quadrantLayer
    : mapState.choroplethLayer;
  if (!activeLayer) return;

  const featureLayer = activeLayer
    .getLayers()
    .find((l) => l.feature.properties.town_name === _lockedPopupTown);
  if (!featureLayer) return;

  // choropleth needs explicit content set; quadrant uses its bindPopup factory
  if (!isQuadrant) {
    featureLayer.setPopupContent(buildChoroplethPopup(_lockedPopupTown));
  }
  featureLayer.openPopup();
}

// clear choropleth fill, legend, and labels — called before activating any special overlay
function clearChoroplethFill(weight = 1) {
  mapState.map.closePopup(); // close any open choropleth feature popup
  mapState.choroplethMetric = null;
  mapState.choroplethLayer.setStyle(() => ({
    color: defaultColors.defaultGray,
    weight,
    fillOpacity: 0,
  }));
  hideLayer(mapState.noFundingHatchLayer); // hatch only relevant when choropleth has fill
  updateChoroplethLegend();
  if (mapState.choroplethLabels)
    mapState.map.removeLayer(mapState.choroplethLabels);
}

// layer visibility helpers
function showLayer(layer) {
  if (layer && !mapState.map.hasLayer(layer)) mapState.map.addLayer(layer);
}
function hideLayer(layer) {
  if (layer && mapState.map.hasLayer(layer)) mapState.map.removeLayer(layer);
}

// update all dashboard components after any state change
function updateDashboard() {
  refreshChoroplethPopups();
  updateMetric();
  renderPlot(metricEngine.baseMetric, mapState.selectedTown);
  renderStatsCard(mapState.selectedTown);
  renderRankings(
    metricEngine.baseMetric,
    metricEngine.isRelative,
    mapState.selectedTown,
  );
  updateOverlayDefinition();
  updateModelDefinition();
  updateClaimsBenchmarkNote();
}

// refresh open choropleth popup and current tooltip content (eachLayer reaches individual feature layers)
function refreshChoroplethPopups() {
  // refresh open choropleth popup and current tooltip content (eachLayer reaches individual feature layers)
  if (mapState.choroplethLayer) {
    mapState.choroplethLayer.eachLayer((fl) => {
      const town = fl.feature.properties.town_name;
      if (fl.isPopupOpen()) {
        fl.setPopupContent(buildChoroplethPopup(town));
      }
      // always update tooltip content so sticky tooltips don't re-open with stale text
      fl.setTooltipContent(buildChoroplethHover(town));
    });
  }
}

// show the definition matching the currently active overlay; hides all others
function updateOverlayDefinition() {
  document.querySelectorAll(".metric-definition").forEach((el) => {
    el.style.display = "none";
  });
  const id = overlayDefMap[mapState._activeOverlay];
  if (id) {
    const el = document.getElementById(id);
    if (el) el.style.display = "block";
  }
}

// show the definition matching the currently active model; hides all others
function updateModelDefinition() {
  const modelDefMap = {
    eal: "model-def-eal",
    eal_per_capita: "model-def-eal-per-capita",
    nri: "model-def-nri",
  };
  document.querySelectorAll(".model-definition").forEach((el) => {
    el.style.display = "none";
  });
  const id = modelDefMap[mapState.model];
  if (id) {
    const el = document.getElementById(id);
    if (el) el.style.display = "block";
  }
}

// show/hide the claims benchmark note based on active overlay
function updateClaimsBenchmarkNote() {
  const note = document.getElementById("claims-benchmark-note");
  if (note)
    note.style.display =
      mapState._activeOverlay === baseToOverlay["claims"] ? "block" : "none";
}

/////////////////////////////////////////////////////////////

// update map layers based on selected metric, model, and active overlay

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
}

// update choropleth legend based on current metric
function updateChoroplethLegend() {
  // remove any existing choropleth legend
  if (mapState.choroplethLegend) {
    mapState.map.removeControl(mapState.choroplethLegend);
    mapState.choroplethLegend = null;
  }

  // safety check
  if (!mapState.choroplethMetric) return;

  // add new legend
  mapState.choroplethLegend = addLegend("choropleth").addTo(mapState.map);
}

// toggle population bubble layer on/off
function togglePopBubbleLayer() {
  // initialize bubble layer if it doesn't exist yet (first time toggling on)
  if (!mapState.popBubbleLayer) {
    mapState.popBubbleLayer = initializePopBubbleChartLayer();
  }

  // hide river corridors — bubbles are cleaner without them
  hideLayer(mapState.riverCorridorsLayer);

  // show bubble layer if not present
  showLayer(mapState.popBubbleLayer);
  applyZoomLabelVisibility(); // apply zoom-gating to labels

  // set choropleth to null (default borders, no fill), update legend, hide choropleth labels
  clearChoroplethFill();
  mapState.choroplethLegend = addLegend("population-bubble").addTo(
    mapState.map,
  );
}

// toggle funding bubble layer on/off
function toggleFundingBubbleLayer() {
  if (!mapState.fundingBubbleLayer) {
    mapState.fundingBubbleLayer = initializeFundingBubbleLayer();
  }

  // hide river corridors — bubbles are cleaner without them
  hideLayer(mapState.riverCorridorsLayer);

  // show funding bubble layer if not present
  showLayer(mapState.fundingBubbleLayer);
  applyZoomLabelVisibility(); // apply zoom-gating to labels

  // clear choropleth
  clearChoroplethFill();
  mapState.choroplethLegend = addLegend("funding-bubble").addTo(mapState.map);
}

// toggle quadrant layer on/off
function toggleQuadrantLayer() {
  // initialize quadrant layer if it doesn't exist yet (first time toggling on)
  if (!mapState.quadrantLayer) {
    mapState.quadrantLayer = initializeQuadrantLayer();
  }

  // clear choropleth and add quadrant layer
  clearChoroplethFill();
  showLayer(mapState.quadrantLayer);

  // suppress any visible labels (quadrant has no text labels)
  applyZoomLabelVisibility();
  // update legend to quadrant legend
  updateQuadrantLegend();
}

// update quadrant legend
function updateQuadrantLegend() {
  // remove existing choropleth legend if present
  if (mapState.choroplethLegend) {
    mapState.map.removeControl(mapState.choroplethLegend);
  }

  mapState.choroplethLegend = addLegend("quadrant").addTo(mapState.map);
}

// focus/unfocus the river corridors view — brightens corridors, clears choropleth fill
function toggleRiverCorridorsFocusView() {
  mapState.riverCorridorsFocused = !mapState.riverCorridorsFocused;

  if (mapState.riverCorridorsFocused) {
    // clear choropleth fill, suppress labels, set thin town outlines
    clearChoroplethFill(0.25);
    applyZoomLabelVisibility(); // hide labels

    // raise river corridors pane above town choropleth (overlayPane = 400)
    mapState.map.getPane("riverCorridorsPane").style.zIndex = 410;

    // boost river corridors tier 1 opacity
    if (mapState.riverCorridorsLayer) {
      mapState.riverCorridorsLayer.setStyle(RIVER_STYLE_FOCUSED);
    }

    // show explanatory legend
    mapState.riverCorridorsLegend = addLegend("river-corridors").addTo(
      mapState.map,
    );
  } else {
    restoreRiverCorridorsDefaultStyle();
  }
}

// restore river corridors to default style
function restoreRiverCorridorsDefaultStyle() {
  // safety check, then set river corridors boolean to false
  if (!mapState.riverCorridorsFocused) return;
  mapState.riverCorridorsFocused = false;

  // restore pane below towns
  mapState.map.getPane("riverCorridorsPane").style.zIndex = 350;

  // restore river corridors tier 1 style
  if (mapState.riverCorridorsLayer) {
    mapState.riverCorridorsLayer.setStyle(RIVER_STYLE_DEFAULT);
  }

  // remove explanatory legend
  if (mapState.riverCorridorsLegend) {
    mapState.map.removeControl(mapState.riverCorridorsLegend);
    mapState.riverCorridorsLegend = null;
  }
}

//////////////////////////////////////////////////////////

// map movement functions for resetting to VT view and zooming into selected town

// enable || disable buttons
function toggleButton(buttonId, enable = true) {
  const button = document.getElementById(buttonId);
  if (button) {
    button.disabled = !enable;
    // button.style.display = enable ? 'block' : 'none'; // use if visibility needs changing
  }
}

// resets map view to all of VT, updates infoBox and plots
function resetMapView() {
  // center map on State of Vermont and reset zoom
  mapState.map.setView(vtDefaultView.center, vtDefaultView.zoom);

  // reset choropleth style (towns may remain uncovered otherwise)
  if (mapState.choroplethLayer) {
    mapState.choroplethLayer.resetStyle();
  }

  // Close any open popups (choropleth feature popups or bubble popups)
  // and clear locked popup tracking so popups don't persist after reset
  if (lockedPopupLayer) {
    lockedPopupLayer.closePopup();
    lockedPopupLayer = null;
  }

  // close any popups not specifically tracked by lockedPopupLayer (necessary)
  if (mapState.map && typeof mapState.map.closePopup === "function") {
    mapState.map.closePopup();
  }
  _lockedPopupTown = null;
}

// zooms map for town view, updates infoBox and plots
function zoomIn() {
  // reset choropleth boundaries (or they will remain uncovered)
  if (mapState.choroplethLayer) {
    mapState.choroplethLayer.resetStyle();
  }

  // get town boundaries
  const boundaries = mapState.choroplethLayer
    .getLayers()
    .find(
      (layer) => layer.feature.properties.town_name === mapState.selectedTown,
    );

  // update map view — selected-town highlight is handled in the style function, not here
  if (boundaries) {
    mapState.map.fitBounds(boundaries.getBounds());
    // move selected town's <path> to end of SVG DOM so its border renders on top
    boundaries.bringToFront();
    // re-raise hatch paths above the choropleth fill (all paths share one flat SVG)
    if (
      mapState.noFundingHatchLayer &&
      mapState.map.hasLayer(mapState.noFundingHatchLayer)
    ) {
      mapState.noFundingHatchLayer.bringToFront();
    }
  }

  // same bringToFront for quadrant layer, so its border render on top
  if (mapState.quadrantLayer) {
    const qBoundaries = mapState.quadrantLayer
      .getLayers()
      .find(
        (layer) => layer.feature.properties.town_name === mapState.selectedTown,
      );
    if (qBoundaries) qBoundaries.bringToFront();
  }
}
