// Description: This file contains the functions to create the map and controls, and to handle user interactions

// globals for tracking map state and active layers
const mapState = {
  map: null,
  selectedTown: "top",
  model: "eal",
  isRelative: false,

  bubbleLayer: null,
  choroplethLayer: null,
  choroplethLabels: null,
  choroplethMetric: null,
  choroplethLegend: null,
};

//////////////////////////////////////////////////////////

// map creation
function createMap() {
  mapState.map = initializeMap();

  addBaseLayerControl();

  // initialize dropdown and choropleth layer
  initializeTownsDropdown();

  // event listeners for resizing
  window.addEventListener("resize", () => {
    mapState.map.invalidateSize();
  });

  // resize map to ensure it loads correctly
  mapState.map.invalidateSize();

  // set marker scheme to none initially
  mapState.model = "eal";

  // set initial choropleth metric and add layer to map
  metricEngine.baseMetric = "gap";
  updateMetric();
  mapState.choroplethLayer.addTo(mapState.map);
  renderStatsCard("top");

  // setup UI control event listeners
  initializeUIControls();
}

//////////////////////////////////////////////////////////

// initialize the map
function initializeMap() {
  const baseLayer = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  );
  mapState.map = L.map("map-id", {
    center: [44.0, -72.7], // center on Vermont
    zoom: 8,
    layers: [baseLayer],
  });
  addResetButton();
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

// add the base layers and control
function addBaseLayerControl() {
  let baseMap = {
    "Street Map": L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    ),
    Satellite: L.esri.basemapLayer("Imagery"),
    "National Geographic": L.esri.basemapLayer("NationalGeographic"),
    Topographic: L.esri.basemapLayer("Topographic"),
    Grayscale: L.esri.basemapLayer("Gray"),
  };
  L.control.layers(baseMap, null).addTo(mapState.map);
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

// setup event listeners for UI controls
function initializeUIControls() {
  wireTownsDropdown();
  wireChoroplethButtons();
  wireRelativeToggle();
  wireMarkerControls();
  wireResponsiveControlMove();
  wireMapZoomLabelToggle();
}

// event listener for town dropdown changes to update map and other components
function wireTownsDropdown() {
  const dropdown = document.getElementById("towns-dropdown");
  // safety check
  if (!dropdown) return;

  // event listener for dropdown changes
  dropdown.addEventListener("change", (e) => {
    const selected = e.target.value;

    // update selected town in mapState
    mapState.selectedTown = selected;

    // update stats card with new town data
    renderStatsCard(mapState.selectedTown);

    // update plot
    renderPlot(metricEngine.baseMetric, mapState.selectedTown);

    // update rankings table
    renderRankings(
      mapState.choroplethMetric,
      mapState.isRelative,
      mapState.selectedTown,
    );

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
  ].filter(Boolean);

  // set initial active button on load
  syncChoroplethButtons("Gap (Funding vs Need)");

  // event listener for choropleth changes
  containers.forEach((container) => {
    container.addEventListener("click", (e) => {
      const selectedOverlay = e.target.getAttribute("data-overlay");
      if (!selectedOverlay) return;

      // update map based on selected overlay
      handleOverlaySelection(selectedOverlay);
      syncChoroplethButtons(selectedOverlay);
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
        updateMetric();
      }

      // sync both sliders
      toggles.forEach((t) => {
        t.checked = mapState.isRelative;
      });
      updateToggleLabels();
    });
  });
}

// setup event listener for marker scheme changes and toggle active class for buttons
function wireMarkerControls() {
  const container = document.getElementById("marker-overlay-group");
  const labels = container.querySelectorAll("label");

  // event listener for marker scheme changes
  container.addEventListener("change", (e) => {
    const scheme = e.target.getAttribute("data-overlay");
    if (!scheme) return;

    // toggle active class for ui visual feedback
    labels.forEach((l) => l.classList.remove("active"));
    e.target.parentElement.classList.add("active");

    // update marker scheme in mapState and refresh markers
    mapState.model = resolveModel(scheme);
    metricEngine.model = mapState.model;
    updateMetric();
  });
}

// move control on load and on resize for mobile responsiveness
function wireResponsiveControlMove() {
  moveChoroplethControl();
  window.addEventListener("resize", moveChoroplethControl);
}

// toggle choropleth labels based on zoom level to avoid visual clutter
function wireMapZoomLabelToggle() {
  applyZoomLabelVisibility(); // apply on init
  mapState.map.on("zoomend", applyZoomLabelVisibility);
}

/////////////////////////////////////////////////////////////

// helpers for event listeners and UI state management

// syncs active state of choropleth buttons for consistent UI feedback across multiple button groups
function syncChoroplethButtons(selectedOverlay) {
  const allButtons = document.querySelectorAll(
    "#choropleth-control button, #choropleth-control-secondary button",
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

// toggle to move choropleth control for mobile responsiveness
function moveChoroplethControl() {
  const control = document.getElementById("choropleth-control");
  const mapContainer = document.querySelector(".map-container");
  const parentRow = document.querySelector(".row");

  if (window.innerWidth <= 600) {
    // move below map
    if (parentRow && control && control.parentNode !== parentRow) {
      parentRow.appendChild(control);
    }
  } else {
    // move inside map
    if (mapContainer && control && control.parentNode !== mapContainer) {
      mapContainer.appendChild(control);
    }
  }
}

// toggle choropleth labels based on zoom level to avoid visual clutter
function applyZoomLabelVisibility() {
  // get zoom and bubble layer state to determine which labels to show/hide
  const zoom = mapState.map.getZoom();
  const bubbleActive =
    mapState.bubbleLayer && mapState.map.hasLayer(mapState.bubbleLayer);

  // determine which label layer is active; only show that one
  const activeLabels = bubbleActive
    ? mapState.bubbleLabels
    : mapState.choroplethLabels;
  const inactiveLabels = bubbleActive
    ? mapState.choroplethLabels
    : mapState.bubbleLabels;

  // always hide the inactive layer's labels
  if (inactiveLabels) mapState.map.removeLayer(inactiveLabels);

  // show active labels only if zoomed in enough
  if (activeLabels) {
    if (zoom >= 9) {
      activeLabels.addTo(mapState.map);
    } else {
      mapState.map.removeLayer(activeLabels);
    }
  }
}

/////////////////////////////////////////////////////////////

// track and set active metric for updating dashboard components based on user interactions
// with helper to format metric values for labels based on metric type (e.g., percentage, currency, ratio)

// resolve model based on selected option
function resolveModel(label) {
  if (label === "EAL") return "eal";
  if (label === "EAL per capita") return "eal_per_capita";
  if (label === "NRI") return "nri";
  return "eal"; // safe default
}

// render choropleth layer based on selected metric and model
const metricEngine = {
  // default to gap metric and EAL model on load
  baseMetric: "gap",
  model: "eal",
  isRelative: false,

  // mapping from user-friendly overlay labels to metric keys
  overlayToBase: {
    Risk: "risk",
    "Social Vulnerability": "vulnerability",
    "Need Index": "need",
    Funding: "funding",
    "Gap (Funding vs Need)": "gap",
  },

  // resolve metric key based on current base metric, model, and relative mode
  getMetricKey() {
    const { baseMetric, model, isRelative } = this;

    // safety check
    if (!baseMetric) return null;

    // non-model metrics
    if (baseMetric === "funding") {
      return isRelative ? "funding_rel" : "funding_total";
    }

    if (baseMetric === "vulnerability") {
      return isRelative ? "vulnerability_rel" : "vulnerability_rank";
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

    return `${baseMetric}_rank_${model}`;
  },
};

// helper function to format metric values for labels
function formatMetric(metric, value) {
  if (!metric || value == null || isNaN(value)) return "";

  if (metric.includes("funding_total")) {
    return `$${d3.format(",.0f")(value)}`;
  }

  if (metric.includes("_rel")) {
    return `${value > 0 ? "+" : ""}${Math.round(value * 100)}%`;
  }

  if (metric.includes("rank")) {
    return `${Math.round(value * 100)}%`;
  }

  return d3.format(".2f")(value);
}

/////////////////////////////////////////////////////////////

// update map layers and dashboard components based on selected metric and model

// change map overlay based on selected option
function handleOverlaySelection(selectedOverlay) {
  // early exit if no overlay selected
  if (!selectedOverlay) return;

  // add bubble layer and exit if selected
  if (selectedOverlay === "Population") {
    toggleBubbleLayer();
    return;
  }

  // update base metric to trigger style and legend updates
  metricEngine.baseMetric = metricEngine.overlayToBase[selectedOverlay];
  removeBubbleLayerIfPresent();
  updateMetric();
}

// utility function to remove bubble layer if it exists
function removeBubbleLayerIfPresent() {
  if (mapState.bubbleLayer && mapState.map.hasLayer(mapState.bubbleLayer)) {
    mapState.map.removeLayer(mapState.bubbleLayer);
  }
}

// render choropleth based on selected metric and town
function updateMetric() {
  // set choropleth metric in mapState
  const metricKey = metricEngine.getMetricKey();
  mapState.choroplethMetric = metricKey;

  // update choropleth layer style based on new metric
  mapState.choroplethLayer.options.metric = metricKey;
  mapState.choroplethLayer.setStyle(mapState.choroplethLayer.options.style);

  // update labels and legend for new metric
  updateChoroplethLabels();
  updateChoroplethLegend();

  // update plot based on new metric
  renderPlot(metricEngine.baseMetric, mapState.selectedTown);

  // update stats card for new model/metric
  renderStatsCard(mapState.selectedTown);

  // update rankings table based on new metric
  renderRankings(
    metricEngine.baseMetric,
    metricEngine.isRelative,
    mapState.selectedTown,
  );
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

// toggle bubble layer on/off
function toggleBubbleLayer() {
  // initialize bubble layer if it doesn't exist yet (first time toggling on)
  if (!mapState.bubbleLayer) {
    mapState.bubbleLayer = initializeBubbleChartLayer();
  }

  // show bubble layer if not present
  if (!mapState.map.hasLayer(mapState.bubbleLayer)) {
    mapState.map.addLayer(mapState.bubbleLayer);
    applyZoomLabelVisibility(); // apply zoom gating to bubble labels
  }

  // set choropleth to null (default borders, no fill), update legend, hide choropleth labels
  mapState.choroplethMetric = null;
  mapState.choroplethLayer.setStyle(() => ({
    color: defaultColors.defaultGray,
    weight: 1,
    fillOpacity: 0,
  }));
  updateChoroplethLegend();
  if (mapState.choroplethLabels) {
    mapState.map.removeLayer(mapState.choroplethLabels);
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
  mapState.map.setView([44.0, -72.7], 8);
  // reset choropleth style (towns may remain uncovered otherwise)
  if (mapState.choroplethLayer) {
    mapState.choroplethLayer.resetStyle();
  }

  // toggle button
  toggleButton("population-button", true);
}

// zooms map for town view, updates infoBox and plots
function zoomIn() {
  // toggle button
  toggleButton("population-button", false);

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
