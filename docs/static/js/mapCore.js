// ==========================================================
// Map Core
//
// Initializes the Leaflet map and bootstraps application state.
//
// Responsibilities:
// • Create the map and shared panes
// • Initialize runtime configuration
// • Configure interactive vs. export mode
// • Initialize default layers
// • Manage global map state
// ==========================================================

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
  noFundingHatchLayer: null, // overlay layer for zero-funding towns (drawn on top of choropleth)
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
let _lockedPopupTown = null; // tracks open town popup across overlay switches

//////////////////////////////////////////////////////////

// map creation
function createMap() {
  // build runtime configuration (interactive defaults or export overrides)
  const config = buildRuntimeConfig(window.__EXPORT_CONFIG);

  // initialize core map and DOM elements
  initializeCoreMap();

  // apply initial map state (view, model, base metric, layers, etc.)
  applyInitialMapState(config);

  // activate the desired starting overlay (choropleth/quadrant/etc)
  activateInitialOverlay(config);

  // sync dashboard/UI with initial state
  updateDashboard();

  // start either interactive runtime UI or export synchronization
  initializeRuntimeMode(config);
}

//////////////////////////////////////////////////////////

// helpers for interactive mode vs export mode

// build runtime configuration from export settings, or default interactive settings
function buildRuntimeConfig(raw) {
  const exportConfig = raw || window.__EXPORT_CONFIG || {};
  const baseMetric = exportConfig.baseMetric || "gap";
  return {
    // export mode boolean flag
    exportMode: !!exportConfig.exportMode,

    // optional view override
    center:
      Array.isArray(exportConfig.center) && exportConfig.center.length === 2
        ? exportConfig.center
        : null,
    zoom: typeof exportConfig.zoom === "number" ? exportConfig.zoom : null,

    // initial metric/model configuration
    model: exportConfig.model || "eal_per_capita",
    baseMetric,
    overlay: resolveInitialOverlay(exportConfig, baseMetric),

    // display options
    isRelative: !!exportConfig.isRelative,
    noRiverCorridors: !!exportConfig.noRiverCorridors,
  };
}

// resolve initial overlay based on export configuration or defaults
function resolveInitialOverlay(exportConfig, baseMetric) {
  if (exportConfig && exportConfig.overlay) return exportConfig.overlay;
  if (!exportConfig || !exportConfig.exportMode) return "Quadrants";
  return baseToOverlay[baseMetric] || "Quadrants";
}

// initialize core map and shared DOM elements
function initializeCoreMap() {
  mapState.map = initializeMap();
  initializeTownsDropdown();

  // event listeners for resizing
  window.addEventListener("resize", () => mapState.map.invalidateSize());
  // resize map to ensure it loads correctly
  mapState.map.invalidateSize();
}

// apply initial map configuration
function applyInitialMapState(config) {
  // apply exported view override (if any)
  if (config.center) {
    if (config.zoom) mapState.map.setView(config.center, config.zoom);
    else mapState.map.setView(config.center);
  } else if (config.zoom) {
    mapState.map.setZoom(config.zoom);
  }

  // initialize map state and metric engine
  mapState.model = config.model;
  metricEngine.baseMetric = config.baseMetric;
  metricEngine.model = config.model;
  metricEngine.isRelative = !!config.isRelative;
  mapState.isRelative = !!config.isRelative;

  // add river corridors tier 1 before choropleth so it renders beneath it
  initializeRiverCorridors(config);
  if (mapState.choroplethLayer) mapState.choroplethLayer.addTo(mapState.map);
}

// initialize default river corridors unless export disables them
function initializeRiverCorridors(config) {
  // early exit if river corridors are disabled
  if (config.noRiverCorridors) return;

  // initialize once
  if (!mapState.riverCorridorsLayer) {
    mapState.riverCorridorsLayer = initializeRiverCorridorsLayer(
      riverCorridors,
      1,
    );
  }

  // safety check
  if (!mapState.map.hasLayer(mapState.riverCorridorsLayer)) {
    mapState.riverCorridorsLayer.addTo(mapState.map);
  }
}

// activate requested starting overlay
function activateInitialOverlay(config) {
  mapState._activeOverlay = config.overlay;
  handleOverlaySelection(config.overlay);
}

// initialize either interactive mode or export mode
function initializeRuntimeMode(config) {
  if (config.exportMode) initializeExportMode(config);
  else initializeInteractiveMode(config);
}

// wire UI controls for normal interactive use
function initializeInteractiveMode() {
  initializeUIControls();
}

// wait for rendering instead of wiring UI controls
function initializeExportMode(/*config*/) {
  try {
    waitForExportRender();
  } catch (e) {
    window.__EXPORT_READY = true;
  }
}

// wait until map tiles finish loading before signaling export readiness
function waitForExportRender() {
  let pendingTiles = 0;
  const baseTile = baseLayers.Satellite;
  if (baseTile && baseTile.on) {
    const onStart = () => {
      pendingTiles++;
    };
    const onDone = () => {
      pendingTiles = Math.max(0, pendingTiles - 1);
      if (pendingTiles === 0) {
        setTimeout(() => (window.__EXPORT_READY = true), 300);
      }
    };
    baseTile.on("tileloadstart", onStart);
    baseTile.on("tileload", onDone);
    baseTile.on("tileerror", onDone);
    // fallback safety timeout
    setTimeout(() => {
      if (!window.__EXPORT_READY) window.__EXPORT_READY = true;
    }, 15000);
  } else {
    // tile events unavailable — assume rendering completes shortly
    setTimeout(() => (window.__EXPORT_READY = true), 500);
  }
}

//////////////////////////////////////////////////////////

// initialize the map
function initializeMap() {
  mapState.map = L.map("map-id", {
    center: vtDefaultView.center,
    zoom: vtDefaultView.zoom,
    zoomSnap: 0, // enable fractional zoom levels for smoother zooming (and export_maps.js zoom override uses 8.5)
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
    _lockedPopupTown = null;
  });
}

/////////////////////////////////////////////////////////////

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
