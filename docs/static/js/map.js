// Description: This file contains the functions to create the map and controls, and to handle user interactions

// globals for tracking map state and active layers
const mapState = {
  map: null,
  selectedTown: "top",
  model: "eal_per_capita",
  isRelative: false,
  _activeOverlay: "Quadrants",

  riverCorridorsLayer: null,
  riverCorridorsTier2Layer: null,
  riverCorridorsFocused: false,
  riverCorridorsLegend: null,

  popBubbleLayer: null,
  popBubbleLabels: null,
  fundingBubbleLayer: null,
  fundingBubbleLabels: null,
  quadrantLayer: null,
  quadrantLegend: null,

  choroplethLayer: null,
  choroplethLabels: null,
  choroplethMetric: null,
  choroplethLegend: null,
};

// base tile layers
const baseLayers = {
  Satellite: L.esri.basemapLayer("Imagery"),
  "Street Map": L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  ),
  "National Geographic": L.esri.basemapLayer("NationalGeographic"),
  Topographic: L.esri.basemapLayer("Topographic"),
  Grayscale: L.esri.basemapLayer("Gray"),
};

// zoom thresholds for map layer visibility
const ZOOM_LABELS = 9; // minimum zoom to show town labels
const ZOOM_RIVER_DETAIL = 11; // minimum zoom to switch to tier 2 river corridors

// global for popups
let lockedPopupLayer = null;

//////////////////////////////////////////////////////////

// map creation
function createMap() {
  mapState.map = initializeMap();

  // addBaseLayerControl();

  // initialize dropdown and choropleth layer
  initializeTownsDropdown();

  // event listeners for resizing
  window.addEventListener("resize", () => {
    mapState.map.invalidateSize();
  });

  // resize map to ensure it loads correctly
  mapState.map.invalidateSize();

  // set model scheme to none initially
  mapState.model = "eal_per_capita";

  // add river corridors tier 1 before choropleth so it renders beneath it
  mapState.riverCorridorsLayer = initializeRiverCorridorsLayer(
    riverCorridors,
    1,
  );
  mapState.riverCorridorsLayer.addTo(mapState.map);

  // set initial choropleth metric, add layer to map, update dashboard components
  metricEngine.baseMetric = "gap";
  metricEngine.model = "eal_per_capita";
  mapState.choroplethLayer.addTo(mapState.map);
  updateDashboard();

  // activate quadrant view as the default overlay
  toggleQuadrantLayer();

  // setup UI control event listeners
  initializeUIControls();
}

//////////////////////////////////////////////////////////

// initialize the map
function initializeMap() {
  mapState.map = L.map("map-id", {
    center: vtDefaultView.center,
    zoom: vtDefaultView.zoom,
    layers: [baseLayers.Satellite],
  });

  // add base layers and control (satellite, street, topo, etc.)
  L.control.layers(baseLayers, null).addTo(mapState.map);

  // custom pane below overlayPane (400) so river corridors always sit under towns
  mapState.map.createPane("riverCorridorsPane");
  mapState.map.getPane("riverCorridorsPane").style.zIndex = 350;

  // add reset button and click handler for dismissing locked popups
  addResetButton();
  wireLockedPopupDismiss();
  return mapState.map;
}

// add reset button to map
function addResetButton() {
  const resetControl = L.control({ position: "topleft" });

  resetControl.onAdd = () => {
    const button = L.DomUtil.create("button", "reset-map-button");
    button.type = "button"; // prevent weird form submission behavior (default is "submit")
    button.innerHTML = '<i class="fas fa-sync"></i>'; // refresh icon
    button.title = "Return map to State of Vermont view"; // tooltip text
    button.setAttribute("aria-label", "Reset map to State of Vermont view"); // accessibility label

    // prevent map interactions when clicking the button
    L.DomEvent.disableClickPropagation(button);

    button.addEventListener("click", () => {
      const dropdown = document.getElementById("towns-dropdown");
      if (dropdown) {
        dropdown.value = "top";
        dropdown.dispatchEvent(new Event("change"));
      }
    });

    return button;
  };

  resetControl.addTo(mapState.map);
}

// close any locked popup when clicking bare map (wired once — not per popup)
function wireLockedPopupDismiss() {
  mapState.map.on("click", () => {
    if (lockedPopupLayer) {
      lockedPopupLayer.closePopup();
      lockedPopupLayer = null;
    }
  });
}

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

      // only update choropleth if it's active (i.e., not bubble)
      if (mapState.choroplethMetric !== null) {
        // update choropleth metric to trigger style and legend updates
        updateDashboard();
      }

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

/////////////////////////////////////////////////////////////

// track and set active metric for updating dashboard components based on user interactions
// with helper to format metric values for labels based on metric type (e.g., percentage, currency, ratio)

// render choropleth layer based on selected metric and model
const metricEngine = {
  // default to gap metric and EAL per capita model on load
  baseMetric: "gap",
  model: "eal_per_capita",
  isRelative: false,

  // mapping from user-friendly overlay labels to metric keys (sourced from config.js)
  overlayToBase,

  // resolve metric key based on current base metric, model, and relative mode
  getMetricKey() {
    const { baseMetric, model, isRelative } = this;

    // safety check
    if (!baseMetric) return null;

    // non-model metrics share the same _rel / _rank pattern
    if (
      baseMetric === "funding" ||
      baseMetric === "vulnerability" ||
      baseMetric === "claims"
    ) {
      return isRelative ? `${baseMetric}_rel` : `${baseMetric}_rank`;
    }

    // model-based
    return isRelative
      ? `${baseMetric}_${model}_rel`
      : `${baseMetric}_rank_${model}`;
  },

  // resolve rank key for rankings table based on current base metric, model, and relative mode
  getRankKey() {
    const { baseMetric, model } = this;

    // safety check
    if (!baseMetric) return null;

    if (baseMetric === "funding") return "funding_rank";
    if (baseMetric === "vulnerability") return "vulnerability_rank";
    if (baseMetric === "claims") return "claims_rank";

    return `${baseMetric}_rank_${model}`;
  },

  // format a metric value for display in labels, legends, and tables
  format(metric, value) {
    if (!metric || value == null || isNaN(value)) return "";
    if (metric.includes("funding_total")) return `$${d3.format(",.0f")(value)}`;
    if (metric.includes("funding_per_capita"))
      return `$${d3.format(",.0f")(value)} pp`;
    if (metric.includes("claims_paid_per_capita"))
      return `$${d3.format(",.0f")(value)} pp`;
    if (metric.includes("_rel"))
      return `${value > 0 ? "+" : ""}${Math.round(value * 100)}%`;
    if (metric.includes("rank")) return `${Math.round(value * 100)}%`;
    return d3.format(".2f")(value);
  },
};

/////////////////////////////////////////////////////////////

// update dashboard components based on selected metric and model

// change map overlay based on selected option
function handleOverlaySelection(selectedOverlay) {
  if (!selectedOverlay) return;

  // special overlays: reset all state, then activate the chosen one
  if (selectedOverlay === "Population") {
    resetOverlayState();
    togglePopBubbleLayer();
    return;
  } else if (selectedOverlay === "Funding Bubble") {
    resetOverlayState();
    toggleFundingBubbleLayer();
    return;
  } else if (selectedOverlay === "Quadrants") {
    resetOverlayState();
    toggleQuadrantLayer();
    return;
  } else if (selectedOverlay === "River Corridors") {
    resetOverlayState();
    toggleRiverCorridorsFocusView();
    return;
  }

  // choropleth metric overlay
  resetOverlayState();
  metricEngine.baseMetric = metricEngine.overlayToBase[selectedOverlay];
  updateDashboard();
}

// tear down all special overlays before activating a new one
function resetOverlayState() {
  hideLayer(mapState.popBubbleLayer);
  hideLayer(mapState.fundingBubbleLayer);
  hideLayer(mapState.quadrantLayer);
  restoreRiverCorridorsDefaultStyle();
  // restore tier 1 river corridors unless tier 2 is currently displayed
  if (!mapState.riverCorridorsTier2Layer) {
    showLayer(mapState.riverCorridorsLayer);
  }
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
    // quadrant layer is visible: update its colors for the new model and keep its legend
    mapState.quadrantLayer.setStyle((feature) => {
      const town = feature.properties.town_name;
      const quadrant = statsByTown[town]?.[`quadrant_${mapState.model}`];
      return {
        fillColor: quadrantColors[quadrant] || defaultColors.defaultGray,
        weight: 1,
        color: "white",
        fillOpacity: 0.7,
      };
    });
    updateQuadrantLegend();
  } else if (
    bubbleActive ||
    fundingBubbleActive ||
    mapState.riverCorridorsFocused
  ) {
    // bubble / river layer is visible: model changed, but don't touch the choropleth or its legend
  } else {
    // choropleth is active: update metric, style, labels, and legend
    const metricKey = metricEngine.getMetricKey();
    mapState.choroplethMetric = metricKey;
    mapState.choroplethLayer.options.metric = metricKey;
    mapState.choroplethLayer.setStyle(mapState.choroplethLayer.options.style);
    updateChoroplethLabels();
    updateChoroplethLegend();
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

  // update map view
  if (boundaries) {
    // set style for selected town
    boundaries.setStyle({
      weight: 3,
      color: "transparent",
      fillOpacity: 0,
      opacity: 0,
    });

    // zoom to town boundaries
    mapState.map.fitBounds(boundaries.getBounds());
  }
}
