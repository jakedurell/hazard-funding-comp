// Description: Functions to create and initialize map layers - towns, choropleth, and bubble chart

// global for popups
let lockedPopupLayer = null;

// get color for choropleth based on metric and value
function getColorForMetric(metric, value) {
  // Remove model suffix (order matters - check eal_per_capita before eal)
  const base = metric.replace(/_(eal_per_capita|eal|nri)/, "");
  const config = choroplethConfig[base];

  // if no config or scale for this metric, return default gray
  if (!config || !config.scale) {
    return defaultColors.defaultGray;
  }
  return config.scale(value);
}

// initialize choropleth layer and zoomIn function to towns
function initializeChoroplethLayer() {
  const choroplethLayer = L.geoJSON(towns, {
    style: (feature) => {
      // if no metric selected, show default gray with no fill
      if (mapState.choroplethMetric == null) {
        return {
          color: defaultColors.defaultGray,
          weight: 1,
          fillOpacity: 0,
        };
      }

      // get metric value for town to determine fill color
      const metric = metricEngine.getMetricKey();
      // const metric = mapState.choroplethLayer.options.metric;
      const value = statsByTown[feature.properties.town_name]?.[metric] || 0;

      return {
        fillColor: getColorForMetric(metric, value),
        weight: 1,
        color: "white",
        fillOpacity: 0.6,
      };
    },
    // on click, update dropdown to zoom in on town
    onEachFeature: (feature, layer) => {
      layer.on("click", function () {
        const selectedTown = feature.properties.town_name;
        const dropdown = document.getElementById("towns-dropdown");
        dropdown.value = selectedTown;
        dropdown.dispatchEvent(new Event("change"));
      });
    },
  });

  // return the layer without adding it to the map
  return choroplethLayer;
}

// create choropleth labels layer with metric values for each town
function updateChoroplethLabels() {
  const map = mapState.map;
  const metric = metricEngine.getMetricKey();

  // remove old layer if it exists
  if (mapState.choroplethLabels) {
    map.removeLayer(mapState.choroplethLabels);
  }

  // create new label layer
  const labelGroup = L.layerGroup();

  // loop through towns to create labels
  towns.features.forEach((feature) => {
    // get town name and centroid for label placement
    const town = feature.properties.town_name;
    const latlng = calculateCentroid(feature);

    let labelHTML = "";

    // if a metric is selected, get the value for this town and format it for the label
    if (metric) {
      const value = statsByTown[town]?.[metric];
      const formatted = formatMetric(metric, value);
      labelHTML = `<div>${formatted}</div>`;
    }

    // create marker with label HTML and add to label layer group
    const label = L.marker(latlng, {
      icon: L.divIcon({
        className: "choropleth-label",
        html: labelHTML,
        iconSize: [100, 24],
        iconAnchor: [50, 12],
      }),
      interactive: false,
    });

    labelGroup.addLayer(label);
  });

  // save reference; let zoom logic decide whether to show them
  mapState.choroplethLabels = labelGroup;
  applyZoomLabelVisibility();
}

// calculates centroid for choropleth and bubble chart layers
function calculateCentroid(feature) {
  const centroid = turf.centroid(feature);
  return [centroid.geometry.coordinates[1], centroid.geometry.coordinates[0]];
}

//////////////////////////////////////////////////////////

// create legend
function addLegend(type) {
  let legend = L.control({ position: "topright" });

  legend.onAdd = function () {
    let div = L.DomUtil.create("div", "custom-legend");
    div.style.zIndex = "1000"; // ensure legend is on top

    // choropleth legend -- create gradient bar and labels based on selected metric
    if (type === "choropleth") {
      const rawMetric = metricEngine.getMetricKey();
      // strip model suffix to match choroplethConfig keys (same as getColorForMetric)
      const metric = rawMetric
        ? rawMetric.replace(/_(eal_per_capita|eal|nri)/, "")
        : null;

      // if no metric selected, return empty legend
      if (!metric || !choroplethConfig[metric]) {
        div.innerHTML = "";
        return div;
      }

      // get config for selected metric to build legend
      const { scale, label } = choroplethConfig[metric];

      // build legend content
      div.innerHTML = `<div class="legend-title">${label}</div>`;

      // create gradient bar and range labels
      const gradientBar = createGradientBar(scale);
      div.appendChild(gradientBar);

      const rangeLabels = createRangeLabels(metric, ...scale.domain());
      div.appendChild(rangeLabels);

      return div;
      // quadrant legend -- create discrete legend based on quadrantColors mapping
    } else if (type === "quadrant") {
      div.innerHTML = `<div class="legend-title">Funding Alignment</div>`;

      // build legend rows (color swatch + label)
      const items = Object.entries(quadrantColors)
        .map(
          ([key, color]) => `
        <div class="quadrants-legend-row">
          <span class="legend-swatch" style="background:${color};"></span>
          ${key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
        </div>
      `,
        )
        .join("");

      // add rows to legend container
      div.innerHTML += items;
      return div;
    }
  };

  return legend;
}

// create gradient bar for choropleth legend
function createGradientBar(scale) {
  const gradientBar = document.createElement("div");
  gradientBar.style.width = "100%";
  gradientBar.style.height = "20px";

  const domain = scale.domain();
  let colors = [];

  // conditional for diverging vs sequential scales
  if (domain.length === 3) {
    // diverging scale: [min, mid, max]
    const [min, mid, max] = domain;
    // 0-49: min to mid, 50-99: mid to max
    for (let i = 0; i < 100; i++) {
      let t, value;
      if (i < 50) {
        t = i / 49; // 0 to 1
        value = min + t * (mid - min);
      } else {
        t = (i - 50) / 49; // 0 to 1
        value = mid + t * (max - mid);
      }
      colors.push(scale(value));
    }
  } else {
    // sequential scale: [min, max]
    const [min, max] = domain;
    colors = Array.from({ length: 100 }, (_, i) => {
      const t = i / 99;
      const value = min + t * (max - min);
      return scale(value);
    });
  }

  // set gradient background using generated colors
  gradientBar.style.background = `linear-gradient(to right, ${colors.join(",")})`;

  return gradientBar;
}

// create labels for choropleth legend price range
function createRangeLabels(metric, ...domain) {
  // create container for labels
  const labelContainer = document.createElement("div");
  labelContainer.style.display = "flex";
  labelContainer.style.justifyContent = "space-between";
  labelContainer.style.alignItems = "center";

  // conditional formatting based on scale type
  if (domain.length === 3) {
    // diverging: min, mid, max
    labelContainer.innerHTML = `
      <div>${formatMetric(metric, domain[0])}</div>
      <div style="text-align:center;">${formatMetric(metric, domain[1])}</div>
      <div style="text-align:right;">${formatMetric(metric, domain[2])}</div>
    `;
  } else {
    // sequential: min, max
    labelContainer.innerHTML = `
      <div>${formatMetric(metric, domain[0])}</div>
      <div style="text-align:right;">${formatMetric(metric, domain[1])}</div>
    `;
  }

  return labelContainer;
}

//////////////////////////////////////////////////////////

// handle popup events
function popupMouseEvents(layer) {
  layer.on({
    mouseover() {
      // only open/close on hover if nothing is locked
      // highlight and reset style on hover
      if (!lockedPopupLayer) {
        highlightMarker(this);
        this.openPopup();
      }
    },

    mouseout() {
      if (!lockedPopupLayer) {
        resetMarkerStyle(this);
        this.closePopup();
      }
    },

    click() {
      // if clicking the already locked layer → unlock it
      if (lockedPopupLayer === this) {
        this.closePopup();
        lockedPopupLayer = null;
        return;
      }

      // if another popup is locked → close it first
      if (lockedPopupLayer) {
        lockedPopupLayer.closePopup();
      }

      // lock this one
      lockedPopupLayer = this;
      this.openPopup();
    },
  });

  // close any open popups when clicking on the map
  mapState.map.on("click", () => {
    if (lockedPopupLayer) {
      lockedPopupLayer.closePopup();
      lockedPopupLayer = null;
    }
  });
}

// highlight marker on hover
function highlightMarker(layer) {
  layer.setStyle({
    radius: layer.options.radius * 2,
    color: "#ffffff",
  });
}

// reset marker style on mouseout
// !!! hardcoded !!! to match createMarkers
function resetMarkerStyle(layer) {
  layer.setStyle({
    radius: 2,
    color: "black",
  });
}

//////////////////////////////////////////////////////////

// create bubble chart layer, - neighoborhood outlines and bubbles of population
function initializeBubbleChartLayer() {
  const bubbleLayerGroup = L.layerGroup(); // create layer group for circle markers
  mapState.bubbleLabels = L.layerGroup(); // separate layer for zoom-gated text labels
  initializeTownOutlines(bubbleLayerGroup, towns);
  addBubbles(bubbleLayerGroup, towns, statsByTown);
  return bubbleLayerGroup;
}

// create town outlines layer
function initializeTownOutlines(bubbleLayerGroup) {
  const townsOutlineLayer = L.geoJSON(towns, {
    style: {
      color: defaultColors.defaultGray,
      weight: 1,
      opacity: 1,
      fillOpacity: 0, // no fill, just outlines
    },
  });
  bubbleLayerGroup.addLayer(townsOutlineLayer);
}

// create bubbles, text markers, and popups for each town
function addBubbles(bubbleLayerGroup) {
  // loop through towns and create bubbles
  towns.features.forEach((feature) => {
    // get town stats for bubble size and popup content
    const town = feature.properties.town_name;
    const avgPrice = +statsByTown[town]?.pct_below_poverty || 0;
    const population = +statsByTown[town]?.population || 0;
    const radius = Math.sqrt(population) * 0.15; // scale radius based on population
    const latlng = calculateCentroid(feature); // for placing markers

    // create circle marker at centroid, bind popup
    const circleMarker = L.circleMarker(latlng, {
      radius: radius,
      fillColor: defaultColors.townColor,
      color: defaultColors.defaultGray,
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8,
    }).bindPopup(
      `${town}<br>
        <span class="popup-text-right">Poverty Rate: ${avgPrice.toFixed(2)}%</span>
        <span class="popup-text-right popup-text-right-larger"><b>Town population: ${population.toLocaleString()}</b></span>`,
      { className: "marker-popup" },
    );

    // create marker with text inside and add to layer
    const textMarker = L.marker(latlng, {
      icon: L.divIcon({
        className: "bubble-text",
        html: `<div>${population.toLocaleString()}</div>`,
        iconSize: [radius * 2, radius * 2], // match size of circle marker
        iconAnchor: [radius, radius], // center text
      }),
      interactive: false,
    });

    // open || close popup
    popupMouseEvents(circleMarker);

    // add circle to main layer, text to separate label layer
    bubbleLayerGroup.addLayer(circleMarker);
    mapState.bubbleLabels.addLayer(textMarker);
  });
}

////////////////////////////////////////////////////////////

// create quadrant choropleth layer with discrete colors based on quadrant assignment
function initializeQuadrantLayer() {
  return L.geoJSON(towns, {
    // style based on quadrant assignment for current model
    style: (feature) => {
      const town = feature.properties.town_name;
      const quadKey = `quadrant_${mapState.model}`;
      const quadrant = statsByTown[town]?.[quadKey];

      return {
        fillColor: quadrantColors[quadrant] || defaultColors.defaultGray,
        weight: 1,
        color: "white",
        fillOpacity: 0.7,
      };
    },

    // add popup and sync town click with dropdown to update other components
    onEachFeature: (feature, layer) => {
      const town = feature.properties.town_name;
      const quadKey = `quadrant_${mapState.model}`;
      const quadrant = statsByTown[town]?.[quadKey];

      // bind popup showing quadrant assignment
      layer.bindPopup(
        `<b>${town}</b><br>${quadrant ? quadrant.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "No data"}`,
      );

      // sync with dropdown on click to zoom in on town and update dashboard
      layer.on("click", function () {
        const dropdown = document.getElementById("towns-dropdown");
        dropdown.value = town;
        dropdown.dispatchEvent(new Event("change"));
      });
    },
  });
}
