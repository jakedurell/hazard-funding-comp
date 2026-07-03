// legend conditional
// gradient bar
// range labels

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
