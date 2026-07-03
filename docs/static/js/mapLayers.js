// Description: Functions to create and initialize map layers - towns, choropleth, and bubble chart

// helper to calculate centroid
// river corridors
// quadrants
// metric choropleths
// bubbles (population and funding)
// popup mouse events

///////////////////////////////////////////////////////

// calculates centroid for choropleth and bubble chart layers
function calculateCentroid(feature) {
  const centroid = turf.centroid(feature);
  return [centroid.geometry.coordinates[1], centroid.geometry.coordinates[0]];
}

///////////////////////////////////////////////////////

// river corridor style constants
// default style for river corridors layer at state-level zoom
const RIVER_STYLE_DEFAULT = {
  color: defaultColors.riverColor,
  weight: 1,
  opacity: 0.7,
  fillColor: defaultColors.riverColor,
  fillOpacity: 0.2,
};
// bolder style for the river corridors layer when focused
const RIVER_STYLE_FOCUSED = {
  color: defaultColors.riverColor,
  weight: 1.5,
  opacity: 0.9,
  fillColor: defaultColors.riverColor,
  fillOpacity: 0.55,
};
// zoomed-in style for the river corridors
// tier 2 style: no stroke — adjacent detailed polygons create visible seams with a stroke
const RIVER_STYLE_TIER2 = {
  stroke: false,
  fillColor: defaultColors.riverColor,
  fillOpacity: 0.5,
};

//////////////////////////////////////////////////////////

// create river corridors layer (used for both tier 1 and tier 2)
function initializeRiverCorridorsLayer(
  data,
  tier = 1,
  pane = "riverCorridorsPane",
) {
  // tier 1: stroked outlines help sparse simplified polygons stand out at state zoom
  // tier 2: no stroke — adjacent detailed polygons create visible seams with a stroke
  const style = tier === 1 ? RIVER_STYLE_DEFAULT : RIVER_STYLE_TIER2;

  return L.geoJSON(data, { style, pane, interactive: false });
}

////////////////////////////////////////////////////////////

// create quadrant choropleth layer with discrete colors based on quadrant assignment
function initializeQuadrantLayer() {
  return L.geoJSON(towns, {
    // style based on quadrant assignment for current model
    style: (feature) => {
      // dynamic styling for selected town highlight
      const town = feature.properties.town_name;
      const isSelected =
        town === mapState.selectedTown && mapState.selectedTown !== "top";
      const quadKey = `quadrant_${mapState.model}`;
      const quadrant = statsByTown[town]?.[quadKey];

      return {
        fillColor: quadrantColors[quadrant] || defaultColors.defaultGray,
        weight: isSelected ? 5 : 1,
        color: isSelected ? quadrantColors[quadrant] : "white",
        fillOpacity: isSelected ? 0 : 0.7,
      };
    },

    // add tooltip + popup and sync town click with dropdown to update other components
    onEachFeature: (feature, layer) => {
      const town = feature.properties.town_name;

      // hover tooltip: one-line label
      layer.bindTooltip("", {
        sticky: true,
        className: "choropleth-tooltip",
      });

      layer.on("mouseover", function () {
        if (!this.isPopupOpen()) {
          this.setTooltipContent(buildQuadrantHover(town));
          this.openTooltip();
        }
      });

      layer.on("mouseout", function () {
        this.closeTooltip();
      });

      layer.on("popupopen", function () {
        this.closeTooltip();
      });

      layer.bindPopup(() => buildQuadrantPopup(town), {
        className: "choropleth-tooltip",
      });

      // sync with dropdown on click to zoom in on town and update dashboard
      layer.on("click", function () {
        _lockedPopupTown = town; // track for choropleth-quadrant popup persistence
        const dropdown = document.getElementById("towns-dropdown");
        dropdown.value = town;
        dropdown.dispatchEvent(new Event("change"));
      });
    },
  });
}

///////////////////////////////////////////////////////

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
      // dynamic styling for selected town highlight
      const town = feature.properties.town_name;
      const isSelected =
        town === mapState.selectedTown && mapState.selectedTown !== "top";

      // if no metric selected, show default gray with no fill
      if (mapState.choroplethMetric == null) {
        return {
          color: isSelected ? "white" : defaultColors.defaultGray,
          weight: isSelected ? 5 : 1,
          fillOpacity: 0,
        };
      }

      // get metric value for town to determine fill color
      const metric = metricEngine.getMetricKey();
      const value = statsByTown[town]?.[metric] || 0;

      return {
        fillColor: getColorForMetric(metric, value),
        weight: isSelected ? 5 : 1,
        color: isSelected ? getColorForMetric(metric, value) : "white",
        fillOpacity: isSelected ? 0 : 0.6,
      };
    },
    // hover tooltip (desktop) + click popup (mobile / persistent)
    onEachFeature: (feature, layer) => {
      const town = feature.properties.town_name;

      // tooltip: lightweight, follows cursor, suppressed while popup is open
      layer.bindTooltip("", {
        sticky: true,
        className: "choropleth-tooltip",
      });

      layer.on("mouseover", function () {
        if (!this.isPopupOpen()) {
          this.setTooltipContent(buildChoroplethHover(town));
          this.openTooltip();
        }
      });

      layer.on("mouseout", function () {
        this.closeTooltip();
      });

      // popup: persists on click (works on mobile); reuses same content builder
      layer.bindPopup("", { className: "choropleth-tooltip" });

      // belt-and-suspenders: close tooltip after popup fully opens
      layer.on("popupopen", function () {
        this.closeTooltip();
      });

      layer.on("click", function () {
        this.closeTooltip();
        this.setPopupContent(buildChoroplethPopup(town));
        _lockedPopupTown = town; // track for choropleth-quadrant popup persistence
        const dropdown = document.getElementById("towns-dropdown");
        dropdown.value = town;
        dropdown.dispatchEvent(new Event("change"));
      });
    },
  });

  // return the layer without adding it to the map
  return choroplethLayer;
}

// inject SVG hatch <defs> into Leaflet's overlay SVG (called once after map is ready)
function injectHatchPattern() {
  const svg = document.querySelector(".leaflet-overlay-pane svg");
  if (!svg || svg.querySelector("#hatch-no-funding")) return; // already injected
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  // no background rect — pattern is transparent so choropleth color shows through
  defs.innerHTML = `
    <pattern id="hatch-no-funding" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="10" stroke="#444" stroke-width="1.5" stroke-opacity="0.7"/>
    </pattern>`;
  svg.insertBefore(defs, svg.firstChild);
}

// create (or return cached) zero-funding hatch overlay layer
// this is a separate GeoJSON layer drawn on top of the choropleth so color shows through
function initializeNoFundingHatchLayer() {
  if (mapState.noFundingHatchLayer) return mapState.noFundingHatchLayer;

  injectHatchPattern();

  mapState.noFundingHatchLayer = L.geoJSON(towns, {
    filter: (feature) => {
      const town = feature.properties.town_name;
      return +statsByTown[town]?.funding_total === 0;
    },
    style: () => ({
      fill: true,
      fillColor: "url(#hatch-no-funding)",
      fillOpacity: 1,
      stroke: false, // no border — choropleth layer handles borders
    }),
    interactive: false, // clicks pass through to choropleth layer beneath
  });

  return mapState.noFundingHatchLayer;
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
      const formatted = metricEngine.format(metric, value);
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

//////////////////////////////////////////////////////////

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

// create bubble chart layer for population
function initializePopBubbleChartLayer() {
  const bubbleLayerGroup = L.layerGroup(); // create layer group for circle markers
  mapState.popBubbleLabels = L.layerGroup(); // separate layer for zoom-gated text labels
  initializeTownOutlines(bubbleLayerGroup); // add town outlines to bubble layer for context

  // top N towns by population get persistent labels at all zoom levels;
  // the rest are zoom-gated via popBubbleLabels (hover tooltips work for all)
  const TOP_LABEL_COUNT = 6;
  const alwaysLabelSet = new Set(
    [...towns.features]
      .filter((f) => +statsByTown[f.properties.town_name]?.population > 0)
      .sort(
        (a, b) =>
          (+statsByTown[b.properties.town_name]?.population || 0) -
          (+statsByTown[a.properties.town_name]?.population || 0),
      )
      .slice(0, TOP_LABEL_COUNT)
      .map((f) => f.properties.town_name),
  );

  // loop through towns and create bubbles
  towns.features.forEach((feature) => {
    // get town stats for bubble size and popup content
    const town = feature.properties.town_name;
    const population = +statsByTown[town]?.population || 0;
    const radius = Math.sqrt(population) * 0.15; // scale radius based on population
    const latlng = calculateCentroid(feature); // for placing markers

    // create circle marker at centroid, bind popup
    const circleMarker = L.circleMarker(latlng, {
      radius: radius,
      fillColor: defaultColors.populationColor,
      color: defaultColors.defaultGray,
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8,
    }).bindPopup(
      `<b>${town}</b>
      Population: ${population.toLocaleString()} residents.<br>
      <span class="popup-note">Population helps contextualize risk and funding across towns of different sizes.</span>`,
      { className: "map-popup" },
    );

    // create marker with text inside and add to layer
    const textMarker = L.marker(latlng, {
      icon: L.divIcon({
        className: "bubble-text",
        html: `<div>${d3.format(".2s")(population)}</div>`,
        iconSize: [radius * 2, radius * 2], // match size of circle marker
        iconAnchor: [radius, radius], // center text
      }),
      interactive: false,
    });

    // open || close popup
    popupMouseEvents(circleMarker);

    // add circle to main layer; top N labels always shown, rest are zoom-gated
    bubbleLayerGroup.addLayer(circleMarker);
    if (alwaysLabelSet.has(town)) {
      bubbleLayerGroup.addLayer(textMarker);
    } else {
      mapState.popBubbleLabels.addLayer(textMarker);
    }
  });

  return bubbleLayerGroup;
}

// create bubble chart layer for total funding
function initializeFundingBubbleLayer() {
  const bubbleLayerGroup = L.layerGroup(); // create layer group for circle markers
  mapState.fundingBubbleLabels = L.layerGroup(); // separate layer for zoom-gated text labels
  initializeTownOutlines(bubbleLayerGroup); // add town outlines to bubble layer for context

  // top N towns by population get persistent labels at all zoom levels;
  // the rest are zoom-gated via fundingBubbleLabels (hover tooltips work for all)
  const TOP_LABEL_COUNT = 6;
  const alwaysLabelSet = new Set(
    [...towns.features]
      .filter((f) => +statsByTown[f.properties.town_name]?.funding_total > 0)
      .sort(
        (a, b) =>
          (+statsByTown[b.properties.town_name]?.funding_total || 0) -
          (+statsByTown[a.properties.town_name]?.funding_total || 0),
      )
      .slice(0, TOP_LABEL_COUNT)
      .map((f) => f.properties.town_name),
  );

  // get max funding value to create a scale for bubble sizes
  const maxFunding = d3.max(
    Object.values(statsByTown),
    (d) => +d.funding_total || 0,
  );
  const radiusScale = d3.scaleSqrt().domain([0, maxFunding]).range([0, 60]);

  // loop through towns and create bubbles
  towns.features.forEach((feature) => {
    const town = feature.properties.town_name;
    const funding = +statsByTown[town]?.funding_total || 0;
    const radius = radiusScale(funding);
    const latlng = calculateCentroid(feature);

    if (funding === 0) return; // skip unfunded towns

    const fundingPc = +statsByTown[town]?.funding_per_capita;
    const fundingPcLine =
      Number.isFinite(fundingPc) && fundingPc > 0
        ? `<br>Equivalent to $${Math.round(fundingPc).toLocaleString()} per resident.`
        : "";

    const circleMarker = L.circleMarker(latlng, {
      radius,
      fillColor: defaultColors.fundingColor,
      color: "#fff",
      weight: 1,
      opacity: 1,
      fillOpacity: 0.75,
    }).bindPopup(
      `<b>${town}</b>
      Received $${Math.round(funding).toLocaleString()} in flood mitigation funding since 1990.${fundingPcLine}<br>
      <span class="popup-note">Bubble size reflects total federal mitigation investment.</span>`,
      { className: "map-popup" },
    );

    // create marker with text inside and add to layer
    const textMarker = L.marker(latlng, {
      icon: L.divIcon({
        className: "bubble-text",
        html: `<div>$${d3.format(".2s")(funding)}</div>`,
        iconSize: [radius * 2, radius * 2],
        iconAnchor: [radius, radius],
      }),
      interactive: false,
    });

    // open || close popup
    popupMouseEvents(circleMarker);

    // add circle to main layer; top N labels always shown, rest are zoom-gated
    bubbleLayerGroup.addLayer(circleMarker);
    if (alwaysLabelSet.has(town)) {
      bubbleLayerGroup.addLayer(textMarker);
    } else {
      mapState.fundingBubbleLabels.addLayer(textMarker);
    }
  });

  return bubbleLayerGroup;
}
//////////////////////////////////////////////////////////

// handle popup events for bubble layers
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
}

// highlight marker on hover
function highlightMarker(layer) {
  layer._originalRadius = layer.options.radius;
  layer._originalColor = layer.options.color;
  layer.setStyle({
    radius: layer.options.radius * 2,
    color: "#ffffff",
  });
}

// reset marker style on mouseout
function resetMarkerStyle(layer) {
  layer.setStyle({
    radius: layer._originalRadius ?? layer.options.radius,
    color: layer._originalColor ?? "black",
  });
}
