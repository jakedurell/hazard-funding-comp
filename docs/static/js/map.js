// Description: This file contains the functions to create the map and controls, and to handle user interactions

// globals for tracking map state and active layers
const mapState = {
  map: null,
  selectedTown: "top",

  model: "default",

  bubbleLayer: null,
  choroplethLayer: null,
  choroplethLabels: null,
  choroplethMetric: null,
  isRelative: false,

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
  mapState.model = "default";

  // set initial choropleth metric and add layer to map
  setChoroplethMetric("gap_eal");
  mapState.choroplethLayer.addTo(mapState.map);
  // renderStatsCard("top");

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
    // renderStatsCard(mapState.selectedTown);

    // update plot
    renderPlot(mapState.choroplethMetric, mapState.selectedTown);

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
      mapState.isRelative = e.target.checked;

      // sync both sliders
      toggles.forEach((t) => {
        t.checked = mapState.isRelative;
      });

      updateToggleLabels();

      // update choropleth metric to trigger style and legend updates
      if (mapState.choroplethMetric) {
        setChoroplethMetric(mapState.choroplethMetric);
      }
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
  });
}

// move control on load and on resize for mobile responsiveness
function wireResponsiveControlMove() {
  moveChoroplethControl();
  window.addEventListener("resize", moveChoroplethControl);
}

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

/////////////////////////////////////////////////////////////

// change map overlay based on selected option
function handleOverlaySelection(selectedOverlay) {
  // early exit if no overlay selected
  if (!selectedOverlay) return;

  // add bubble layer and exit if selected
  if (selectedOverlay === "Population") {
    toggleBubbleLayer();
    return;
  }

  // map overlay names to metric keys for easier handling
  const metricMap = {
    "Gap (Funding vs Need)": "gap_eal",
    Funding: "funding_total",
    "Need Index": "need_eal",
    Risk: "risk_eal",
    "Social Vulnerability": "vulnerability_index",
    // "Total Listings": "total_listings",
  };

  // set choropleth metric to trigger style and legend updates
  const metric = metricMap[selectedOverlay];
  if (metric) {
    removeBubbleLayerIfPresent();
    setChoroplethMetric(metric);
  }
}

// utility function to remove bubble layer if it exists
function removeBubbleLayerIfPresent() {
  if (mapState.bubbleLayer && mapState.map.hasLayer(mapState.bubbleLayer)) {
    mapState.map.removeLayer(mapState.bubbleLayer);
  }
}

// set choropleth metric and update layer style and legend
function setChoroplethMetric(metric) {
  // store selected metric in mapState
  mapState.choroplethMetric = metric;

  // resolve metric key based on relative mode
  const resolved = resolveMetric(metric);

  // update choropleth layer style
  mapState.choroplethLayer.options.metric = resolved;
  mapState.choroplethLayer.setStyle(mapState.choroplethLayer.options.style);
  updateChoroplethLabels();
  updateChoroplethLegend();

  // update plot
  renderPlot(mapState.choroplethMetric, mapState.selectedTown);

  // update rankings table
  renderRankings(
    mapState.choroplethMetric,
    mapState.isRelative,
    mapState.selectedTown,
  );
}

// resolve metric key based on whether relative mode is toggled
function resolveMetric(baseMetric) {
  // safety check
  if (!baseMetric) return null;

  // return base metric if not in relative mode
  if (!mapState.isRelative) return baseMetric;

  // mapping of base metrics to their relative counterparts
  const relativeMap = {
    gap_eal: "gap_eal_std",
    funding_total: "funding_scaled_vs_state_mean",
    need_eal: "need_eal_vs_state_mean",
    risk_eal: "risk_eal_vs_state_mean",
    vulnerability_index: "vulnerability_index_vs_state_mean",
    // total_listings: "total_listings_vs_state_mean",
  };

  // return relative metric if available, else return base metric
  return relativeMap[baseMetric] || baseMetric;
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
  }

  // reset marker radio button to "None" and update button state
  // const markerLabels = document.querySelectorAll("#marker-overlay-group label");
  // markerLabels.forEach((label) => label.classList.remove("active"));
  // // set the first label (EAL) to active (hacky, but it works)
  // let ealLabel = markerLabels[0];
  // if (ealLabel) ealLabel.classList.add("active");

  // set choropleth to null (default borders, no fill) and update legend
  setChoroplethMetric(null);
  updateChoroplethLegend();
}

// resolve model based on selected option
function resolveModel(label) {
  if (label === "EAL") return "default";
  if (label === "EAL per capita") return "perCapita";
  return "none";
}

//////////////////////////////////////////////////////////

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
