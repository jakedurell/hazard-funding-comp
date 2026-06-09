// Description: Functions to create and initialize map layers - towns, choropleth, and bubble chart

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

// calculates centroid for choropleth and bubble chart layers
function calculateCentroid(feature) {
  const centroid = turf.centroid(feature);
  return [centroid.geometry.coordinates[1], centroid.geometry.coordinates[0]];
}

//////////////////////////////////////////////////////////

// create legend, depending on layer type (choropleth vs quadrant vs bubble vs river corridors)
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

      // show active model (human label) under title when available
      // for some base metrics the model is not applicable; show "model independent"
      const activeModelKey = metricEngine && metricEngine.model;
      const activeModelLabel =
        typeof modelKeyToLabel !== "undefined" && activeModelKey
          ? modelKeyToLabel[activeModelKey] || activeModelKey
          : activeModelKey || null;

      // model-independent metrics
      const modelIndependentBases = new Set([
        "vulnerability",
        "claims",
        "funding",
      ]);
      let modelText = null;

      // prefer the canonical base from metricEngine; fall back to stripping suffixes from `metric`
      const baseMetric =
        metricEngine?.baseMetric ??
        (metric ? metric.replace(/_(rank|rel)(?:_.*)?$/, "") : null);

      // conditional for model label text based on whether this metric is model-independent or not
      if (baseMetric && modelIndependentBases.has(baseMetric)) {
        modelText = "Model independent";
      } else if (activeModelLabel) {
        modelText = `Model: ${activeModelLabel}`;
      }

      // style and insert model label
      if (modelText) {
        const modelEl = document.createElement("div");
        modelEl.className = "legend-model";
        modelEl.textContent = modelText;
        modelEl.style.fontSize = "12px";
        modelEl.style.opacity = "0.85";
        modelEl.style.margin = "6px 0";
        const titleEl = div.querySelector(".legend-title");
        if (titleEl) titleEl.insertAdjacentElement("afterend", modelEl);
        else div.insertBefore(modelEl, div.firstChild);
      }

      // create gradient bar and range labels
      const gradientBar = createGradientBar(scale);
      div.appendChild(gradientBar);

      const rangeLabels = createRangeLabels(metric, ...scale.domain());
      div.appendChild(rangeLabels);

      // hatch legend entry — shown on all choropleths
      const hatchRow = document.createElement("div");
      hatchRow.className = "legend-hatch-row";
      hatchRow.innerHTML = `
          <svg width="20" height="12" style="flex-shrink:0;vertical-align:middle;">
            <rect width="20" height="12" fill="#ccc" rx="2"/>
            <line x1="0" y1="12" x2="12" y2="0" stroke="#555" stroke-width="1.5"/>
            <line x1="8" y1="12" x2="20" y2="0" stroke="#555" stroke-width="1.5"/>
          </svg>
          <span>No mitigation funding</span>`;
      div.appendChild(hatchRow);

      return div;
    } else if (type === "quadrant") {
      // quadrant legend -- create discrete legend based on quadrantColors mapping
      div.innerHTML = `<div class="legend-title">Funding Alignment</div>`;

      // show active model label for quadrant-based legends when available
      const activeModelKey = metricEngine && metricEngine.model;
      const activeModelLabel =
        typeof modelKeyToLabel !== "undefined" && activeModelKey
          ? modelKeyToLabel[activeModelKey] || activeModelKey
          : activeModelKey || null;
      // style and insert model label
      if (activeModelLabel) {
        const modelEl = document.createElement("div");
        modelEl.className = "legend-model";
        modelEl.textContent = `Model: ${activeModelLabel}`;
        modelEl.style.fontSize = "12px";
        modelEl.style.opacity = "0.85";
        modelEl.style.margin = "6px 0";
        const titleEl = div.querySelector(".legend-title");
        if (titleEl) titleEl.insertAdjacentElement("afterend", modelEl);
        else div.insertBefore(modelEl, div.firstChild);
      }

      // build legend rows (color swatch + label)
      const items = Object.entries(quadrantColors)
        .map(
          ([key, color]) => `
        <div class="quadrants-legend-row">
          <span class="legend-swatch" style="background:${color};"></span>
          ${quadrantLabels[key] ?? key}
        </div>
      `,
        )
        .join("");

      // add rows to legend container
      div.innerHTML += items;
      return div;
    } else if (type === "population-bubble") {
      // population bubble legend -- create example bubbles with labels for population sizes
      div.innerHTML = `<div class="legend-title">Town Population</div>`;
      const sizes = [1000, 5000, 10000];
      sizes.forEach((pop) => {
        const r = Math.round(Math.sqrt(pop) * 0.15);
        const d = r * 2;
        div.innerHTML += `
          <div style="display:flex;align-items:center;gap:8px;margin:5px 0;">
            <div style="width:${d}px;height:${d}px;border-radius:50%;background:${defaultColors.populationColor};opacity:0.8;flex-shrink:0;"></div>
            <span>${pop.toLocaleString()}</span>
          </div>`;
      });
      return div;
    } else if (type === "funding-bubble") {
      // funding bubble legend -- create example bubbles with labels for funding amounts
      div.innerHTML = `<div class="legend-title">Total Funding</div>`;
      const maxFunding = d3.max(
        Object.values(statsByTown),
        (d) => +d.funding_total || 0,
      );
      const radiusScale = d3.scaleSqrt().domain([0, maxFunding]).range([0, 60]);
      const sizes = [500_000, 1_000_000, 3_000_000].filter(
        (v) => v <= maxFunding * 1.1,
      );
      sizes.forEach((amount) => {
        const r = Math.round(radiusScale(amount));
        const d = r * 2;
        div.innerHTML += `
          <div style="display:flex;align-items:center;gap:8px;margin:5px 0;">
            <div style="width:${d}px;height:${d}px;border-radius:50%;background:${defaultColors.fundingColor};opacity:0.75;flex-shrink:0;"></div>
            <span>$${(amount / 1_000_000).toFixed(1)}M</span>
          </div>`;
      });
      return div;
    } else if (type === "river-corridors") {
      // river corridors legend -- swatch + short geomorphic description
      div.innerHTML = `
        <div class="legend-title">River Corridors</div>
        <div style="display:flex;align-items:center;gap:8px;margin:6px 0 4px;">
          <div style="width:18px;height:12px;background:${defaultColors.riverColor};opacity:0.7;border-radius:2px;flex-shrink:0;"></div>
          <span> VT ANR corridor</span>
        </div>
        <div class="river-corridors-legend-note">
          Areas vulnerable to channel migration<br>
          and flood-related erosion —<br>
          not just mapped inundation zones.
        </div>`;
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

// create labels for choropleth legend range
function createRangeLabels(metric, ...domain) {
  // container for min/max labels
  const labelContainer = document.createElement("div");
  labelContainer.className = "legend-range-labels";

  // get semantic labels for left/right from colors config, otherwise format the raw values
  const labels = legendLabels[metric];
  const low = labels ? labels.low : metricEngine.format(metric, domain[0]);
  const high = labels
    ? labels.high
    : metricEngine.format(metric, domain[domain.length - 1]);

  // set label content
  labelContainer.innerHTML = `
    <span>${low}</span>
    <span>${high}</span>
  `;

  return labelContainer;
}

//////////////////////////////////////////////////////////

// appends note to popups re: active
function buildModelNote() {
  const model = metricEngine.model;
  const note = (text) =>
    `<hr class="popup-divider"><span class="popup-note">${text}</span>`;
  if (model === "eal_per_capita")
    return note(
      "Per-capita model surfaces smaller towns with concentrated exposure.",
    );
  if (model === "eal")
    return note(
      "Absolute loss model weights larger towns with more total exposure.",
    );
  if (model === "nri")
    return note("Based on FEMA's National Risk Index — a composite benchmark.");
  return "";
}

// short one-sentence hover tooltip — shown on mouseover, quickly scannable
function buildChoroplethHover(town) {
  const stats = statsByTown[town];
  if (!stats) return `<b>${town}</b>`;

  const base = metricEngine.baseMetric;
  const model = metricEngine.model;

  const pct = (key) => {
    const v = +stats[key];
    return Number.isFinite(v) ? Math.round(v * 100) : null;
  };

  if (base === "risk") {
    const rankPct = pct(`risk_rank_${model}`);
    return (
      `<b>${town}</b><br>` +
      (rankPct !== null
        ? `Projected flood exposure is higher than ${rankPct}% of Vermont towns.`
        : "Expected flood loss data unavailable.")
    );
  }

  if (base === "vulnerability") {
    const rankPct = pct("vulnerability_rank");
    if (rankPct !== null && rankPct >= 50)
      return `<b>${town}</b><br>Higher vulnerability than ${rankPct}% of Vermont towns.`;
    if (rankPct !== null)
      return `<b>${town}</b><br>Relatively lower social vulnerability than most Vermont towns.`;
    return `<b>${town}</b>`;
  }

  if (base === "need") {
    const rankPct = pct(`need_rank_${model}`);
    return (
      `<b>${town}</b><br>` +
      (rankPct !== null
        ? `Combined flood need ranks higher than ${rankPct}% of Vermont towns.`
        : "Combined need data unavailable.")
    );
  }

  if (base === "funding") {
    const hasFunding = +stats.funding_total > 0;
    const rankPct = pct("funding_rank");
    if (!hasFunding)
      return `<b>${town}</b><br>No recorded FEMA mitigation funding.`;
    return (
      `<b>${town}</b><br>` +
      (rankPct !== null
        ? `Received more mitigation funding than ${rankPct}% of Vermont towns.`
        : "Has received FEMA mitigation funding.")
    );
  }

  if (base === "gap") {
    const gapRank = pct(`gap_rank_${model}`);
    const needRank = pct(`need_rank_${model}`);
    const hasFunding = +stats.funding_total > 0;
    if (!hasFunding)
      return (
        `<b>${town}</b><br>` +
        (needRank >= 70
          ? "No recorded FEMA funding despite elevated flood need."
          : "No recorded FEMA mitigation funding.")
      );
    if (gapRank >= 70)
      return `<b>${town}</b><br>Appears underfunded relative to measured flood need.`;
    if (gapRank <= 30)
      return `<b>${town}</b><br>Has received more funding than its measured need would predict.`;
    return `<b>${town}</b><br>Funding levels appear broadly aligned with measured need.`;
  }

  if (base === "claims") {
    const rankPct = pct("claims_rank");
    if (rankPct !== null && rankPct >= 50)
      return `<b>${town}</b><br>Historical flood insurance claims rank higher than ${rankPct}% of Vermont towns.`;
    if (rankPct !== null)
      return `<b>${town}</b><br>Relatively limited NFIP claims history.`;
    return `<b>${town}</b>`;
  }

  return `<b>${town}</b>`;
}

// expanded click popup — full interpretation with notes, comparisons, and context
function buildChoroplethPopup(town) {
  const stats = statsByTown[town];
  // safety check in case stats are missing for this town (shouldn't happen)
  if (!stats) return `<b>${town}</b>`;

  const base = metricEngine.baseMetric;
  const model = metricEngine.model;

  // rank (0–1) → percentile integer; returns null if missing
  const pct = (key) => {
    const v = +stats[key];
    return Number.isFinite(v) ? Math.round(v * 100) : null;
  };

  // format currency values with safety checks
  const fmt$ = (v) => {
    const n = +v;
    if (!Number.isFinite(n) || n <= 0) return null;
    return n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  };

  // tooltip div
  const note = (text) => `<span class="popup-note">${text}</span>`;

  // render a row of narrative status tags at the top of the popup
  const tags = (...items) =>
    `<div class="popup-tags">${items.map(([variant, label]) => `<span class="popup-tag ${variant}">${label}</span>`).join("")}</div>`;

  // one-line model context note appended to model-aware popups
  const modelNote = () => buildModelNote();

  // conditionals for each metric to build popup content
  if (base === "risk") {
    // define variables
    const rankPct = pct(`risk_rank_${model}`);
    const ealPc = fmt$(stats.EAL_per_capita);
    const inCorridor = +stats.pct_river_corridor > 5;
    // tags
    let tagVariant = "neutral";
    let tagLabel = "DATA LIMITED";
    if (rankPct !== null) {
      tagVariant =
        rankPct >= 75 ? "danger" : rankPct >= 50 ? "warning" : "neutral";
      tagLabel =
        rankPct >= 75
          ? "HIGH EXPOSURE"
          : rankPct >= 50
            ? "ELEVATED EXPOSURE"
            : "LOWER EXPOSURE";
    }
    // html content
    let html = `<b>${town}</b>` + tags([tagVariant, tagLabel]);
    html +=
      rankPct !== null
        ? `Projected flood exposure is higher than ${rankPct}% of Vermont towns.`
        : "Expected flood loss data unavailable.";
    if (ealPc) html += note(`Est. annual flood loss: ${ealPc}/person`);
    if (inCorridor)
      html += note(
        "Large portions of town fall within mapped river corridors.",
      );
    html += modelNote();
    return html;
  }

  if (base === "vulnerability") {
    // define variables
    const rankPct = pct("vulnerability_rank");
    const poverty = +stats.pct_below_poverty;
    const elderly = +stats.percent_elderly;
    const no_vehicle = +stats.pct_no_vehicle;
    // html content with tags
    let html = `<b>${town}</b>`;
    if (rankPct !== null && rankPct >= 75)
      html += tags(["warning", "HIGH VULNERABILITY"]);
    else if (rankPct !== null && rankPct >= 50)
      html += tags(["warning", "ELEVATED VULNERABILITY"]);
    else html += `<br>`;
    if (rankPct !== null && rankPct >= 50) {
      html += `Residents may face greater difficulty recovering from floods.`;
      html += `<br>Higher vulnerability than ${rankPct}% of Vermont towns.`;
    } else if (rankPct !== null) {
      html += `Relatively lower social vulnerability than most Vermont towns.`;
    }
    // conditional notes on drivers of vulnerability
    const drivers = [];
    if (poverty > 15) drivers.push("higher poverty rates");
    if (elderly > 25) drivers.push("older resident populations");
    if (no_vehicle > 10) drivers.push("limited vehicle access");
    if (drivers.length === 1) {
      const single = {
        "higher poverty rates":
          "Higher poverty rates may limit recovery capacity.",
        "older resident populations":
          "Older residents may face additional evacuation and recovery challenges.",
        "limited vehicle access":
          "Limited vehicle access may constrain evacuation and recovery options.",
      };
      html += note(single[drivers[0]]);
    } else if (drivers.length >= 2) {
      const last = drivers.pop();
      const phrase = drivers.join(", ") + " and " + last;
      html += note(
        phrase.charAt(0).toUpperCase() +
          phrase.slice(1) +
          " may limit recovery and evacuation capacity.",
      );
    }
    return html;
  }

  if (base === "need") {
    // define variables
    const rankPct = pct(`need_rank_${model}`);
    const fundRank = pct("funding_rank");
    const hasFunding = +stats.funding_total > 0;
    const diff =
      rankPct !== null && fundRank !== null ? rankPct - fundRank : null;
    // tags
    let tagVariant = "neutral";
    let tagLabel = "DATA LIMITED";
    if (rankPct !== null) {
      tagVariant = rankPct >= 75 ? "info" : rankPct >= 50 ? "info" : "neutral";
      tagLabel =
        rankPct >= 75
          ? "HIGH NEED"
          : rankPct >= 50
            ? "ELEVATED NEED"
            : "LOWER NEED";
    }
    // html content
    let html = `<b>${town}</b>` + tags([tagVariant, tagLabel]);
    html += "Combines estimated flood risk and social vulnerability. ";
    html +=
      rankPct !== null
        ? `Ranks higher than ${rankPct}% of Vermont towns.`
        : "Combined need data unavailable.";
    if (diff !== null) {
      if (diff > 15)
        html += note(
          "Federal mitigation funding trails this town's measured flood need.",
        );
      else if (diff < -15 && hasFunding)
        html += note(
          "Funding levels exceed what measured need alone would predict.",
        );
    }
    html += modelNote();
    return html;
  }

  if (base === "funding") {
    // define variables
    const rankPct = pct("funding_rank");
    const needRank = pct(`need_rank_${model}`);
    const hasFunding = +stats.funding_total > 0;
    const fund = fmt$(stats.funding_total);
    const fpc = fmt$(stats.funding_per_capita);
    const tagItems = hasFunding
      ? [
          [
            rankPct >= 50 ? "success" : "neutral",
            rankPct >= 50 ? "HIGH FEMA INVESTMENT" : "LIMITED FUNDING",
          ],
        ]
      : [["warning", "NO FEMA FUNDING"]];
    // html content
    let html = `<b>${town}</b>` + tags(...tagItems);
    if (!hasFunding) {
      html += "No recorded FEMA mitigation funding.";
      if (needRank >= 50) {
        html += note("Despite comparatively high measured flood need.");
      }
    } else if (rankPct !== null) {
      html += `Received more mitigation funding than ${rankPct}% of Vermont towns.`;
      if (fund) html += note(`Total funding: ${fund} since 1990.`);
      if (fpc) html += note(`Equivalent to ${fpc} per resident.`);
    }
    return html;
  }

  if (base === "gap") {
    // define variables
    const gapRank = pct(`gap_rank_${model}`);
    const needRank = pct(`need_rank_${model}`);
    const fundRank = pct("funding_rank");
    const hasFunding = +stats.funding_total > 0;
    // tags
    const tagItems = [];
    if (!hasFunding) tagItems.push(["warning", "NO FEMA FUNDING"]);
    else if (gapRank >= 70) tagItems.push(["warning", "UNDERFUNDED"]);
    else if (gapRank <= 30) tagItems.push(["success", "FUNDING ALIGNED"]);
    else tagItems.push(["neutral", "ROUGHLY ALIGNED"]);
    if (needRank >= 75) tagItems.push(["info", "HIGH NEED"]);
    // html content
    let html =
      `<b>${town}</b>` + (tagItems.length ? tags(...tagItems) : "<br>");
    if (gapRank !== null) {
      if (!hasFunding) {
        html +=
          needRank >= 70
            ? "No recorded FEMA mitigation funding despite elevated flood risk."
            : "No recorded FEMA mitigation funding.";
      } else if (gapRank >= 70) {
        html += "Appears underfunded relative to measured flood need.";
        const diff =
          needRank !== null && fundRank !== null ? needRank - fundRank : null;
        if (diff !== null && diff > 10)
          html += note(
            `Funding trails measured need by ${diff} percentile points.`,
          );
      } else if (gapRank <= 30) {
        html += hasFunding
          ? "Has received more funding than its measured need would predict."
          : "Flood need is relatively limited compared to other Vermont towns.";
      } else {
        html += "Funding levels appear broadly aligned with measured need.";
      }
    }
    html += modelNote();
    return html;
  }

  if (base === "claims") {
    // define variables
    const rankPct = pct("claims_rank");
    const riskRank = pct(`risk_rank_${model}`);
    const diff =
      rankPct !== null && riskRank !== null ? rankPct - riskRank : null;
    // tags
    const tagItems = [];
    if (rankPct !== null && rankPct >= 50)
      tagItems.push(["danger", "FLOODING HISTORY"]);
    else tagItems.push(["neutral", "LIMITED CLAIMS"]);
    if (diff !== null && diff < -20)
      tagItems.push(["info", "REACTIVE PATTERN"]);
    // html content
    let html = `<b>${town}</b>` + tags(...tagItems);
    if (rankPct !== null && rankPct >= 50) {
      html += `Historical flood insurance claims rank higher than ${rankPct}% of Vermont towns.`;
      if (diff !== null && diff > 20)
        html += note(
          "Historical losses exceed what current modeled risk alone would suggest.",
        );
      html += note(
        "Reflects past insured losses, not necessarily future exposure.",
      );
    } else if (rankPct !== null) {
      html += `Relatively limited NFIP claims history.`;
      if (diff !== null && diff < -20)
        html += note(
          "Projected flood exposure appears higher than historical claims patterns.",
        );
      html += note("Past claims do not fully capture future flood exposure.");
    }
    return html;
  }

  // default fallback
  return `<b>${town}</b>`;
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

// short one-line hover for quadrant layer
function buildQuadrantHover(town) {
  const stats = statsByTown[town];
  if (!stats) return `<b>${town}</b>`;
  const quadrant = stats[`quadrant_${metricEngine.model}`];
  const labels = {
    underfunded: "High flood need, limited mitigation funding.",
    aligned: "Funding broadly aligned with measured flood need.",
    overfunded: "Higher funding relative to measured need.",
    low_priority: "Lower flood need and limited mitigation funding.",
    zero_funding: "No recorded FEMA mitigation funding.",
  };
  return `<b>${town}</b><br>${labels[quadrant] ?? quadrantLabels[quadrant] ?? "No data"}`;
}

// expanded click popup for quadrant layer
function buildQuadrantPopup(town) {
  const stats = statsByTown[town];
  // safety check in case stats are missing for this town (shouldn't happen)
  if (!stats) return `<b>${town}</b>`;

  // define variables for quadrant assignment, risk rank, and helper functions to build HTML snippets
  const quadrant = stats[`quadrant_${metricEngine.model}`];
  const note = (text) => `<span class="popup-note">${text}</span>`;
  const tag = (variant, label) =>
    `<div class="popup-tags"><span class="popup-tag ${variant}">${label}</span></div>`;
  const riskRank = Math.round(
    (+stats[`risk_rank_${metricEngine.model}`] || 0) * 100,
  );

  // conditionals for each quadrant to build tailored popup content
  switch (quadrant) {
    case "underfunded":
      return (
        `<b>${town}</b>` +
        tag("warning", "UNDERFUNDED") +
        `High flood need, limited mitigation funding.<br>` +
        note(
          "One of Vermont's more exposed towns, but has received relatively little federal support.",
        ) +
        buildModelNote()
      );
    case "aligned":
      return (
        `<b>${town}</b>` +
        tag("success", "FUNDING ALIGNED") +
        `Funding levels are broadly aligned with measured flood need.` +
        note("Suggests federal investment has tracked exposure in this town.") +
        buildModelNote()
      );
    case "overfunded":
      return (
        `<b>${town}</b>` +
        tag("neutral", "HIGHER FUNDING") +
        `Has received comparatively high mitigation funding relative to measured need.` +
        note(
          "May reflect past disaster events or infrastructure investments not fully captured by the model.",
        ) +
        buildModelNote()
      );
    case "low_priority":
      return (
        `<b>${town}</b>` +
        tag("neutral", "LOW NEED") +
        `Lower measured flood need and relatively limited mitigation funding.` +
        note(
          "Lower exposure reduces the urgency for federal mitigation investment.",
        ) +
        buildModelNote()
      );
    case "zero_funding": {
      let html =
        `<b>${town}</b>` +
        tag("warning", "NO FEMA FUNDING") +
        `No recorded FEMA mitigation funding.`;
      if (riskRank >= 50)
        html += note(
          `Despite flood risk ranking higher than ${riskRank}% of Vermont towns.`,
        );
      html += buildModelNote();
      return html;
    }
    default:
      return `<b>${town}</b><br>${quadrantLabels[quadrant] ?? "No data"}`;
  }
}

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
