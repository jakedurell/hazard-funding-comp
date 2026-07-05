// ==========================================================
// Data Visualizations
//
// Renders the interactive scatter plot and supporting plot
// elements for the selected town, metric, and model.
//
// Responsibilities:
// • Render the quadrant scatter plot
// • Build and update plot data
// • Manage plot annotations and labels
// • Handle plot interactions and tooltips
// • Update plot titles and captions
// ==========================================================

// render plot based on selected metric and town
function renderPlot(metric, selectedTown) {
  renderQuadrantScatter(selectedTown);
  showPlotHeader(true);
  showPlotCaption();
}

// show/hide plot title
function showPlotHeader(visible) {
  const titleDiv = document.getElementById("plot-title");
  if (titleDiv) titleDiv.style.display = visible ? "block" : "none";
}

// toggle visibility of plot captions based on active model
function showPlotCaption() {
  const all = document.querySelectorAll(".plot-caption");
  all.forEach((el) => (el.style.display = "none"));
  // caption IDs use hyphens: caption-eal, caption-eal-per-capita, caption-nri
  const sel = document.getElementById(
    "caption-" + metricEngine.model.replace(/_/g, "-"),
  );
  if (sel) sel.style.display = "block";
}

//////////////////////////////////////////////////////////

// module-level state for scatter plot
let _prevScatterModel = null;
let _scatterTooltip = null;

// lazy-initialize a fixed-position tooltip div for scatter dot clicks (mobile-friendly)
function getScatterTooltip() {
  if (!_scatterTooltip) {
    _scatterTooltip = document.createElement("div");
    _scatterTooltip.className = "scatter-tooltip";
    document.body.appendChild(_scatterTooltip);
    // dismiss on any non-circle click (circle click uses stopPropagation)
    document.addEventListener("click", () => {
      _scatterTooltip.style.display = "none";
    });
  }
  return _scatterTooltip;
}

// helper to build data array for scatter plot — both axes are percentile ranks (0–1)
function buildScatterData(model) {
  const quadKey = `quadrant_${model}`;
  const needRankKey = `need_rank_${model}`;

  return statsRaw
    .filter((d) => d.town_name !== "State of Vermont")
    .map((d) => ({
      town_name: d.town_name,
      need: +d[needRankKey], // percentile rank of combined need
      funding: +d.funding_rank, // percentile rank of per-capita funding
      funding_pc: +d.funding_per_capita, // for tooltip display
      quadrant: d[quadKey],
      population: +d.population || 0, // for circle sizing
    }))
    .filter((d) => !isNaN(d.need) && !isNaN(d.funding));
}

///////////////////////////////////////////////

// render quadrant scatter plot with median lines and interactive labels based on current model, highlighting selected town
function renderQuadrantScatter(selectedTown) {
  const data = buildScatterData(metricEngine.model);
  const container = document.getElementById("plot-container");
  const width = container.clientWidth;
  const height = 420;
  const margin = { top: 40, right: 20, bottom: 60, left: 60 };

  // select or create persistent SVG — preserves circles between renders for transitions
  let svg = d3.select(container).select("svg.scatter-svg");
  if (svg.empty()) {
    svg = d3
      .select(container)
      .append("svg")
      .attr("class", "scatter-svg")
      .attr("width", width)
      .attr("height", height);
  }

  // capture current circle positions from the DOM before any changes (used for movement trails)
  const prevPositions = new Map();
  svg
    .select("g.dots")
    .selectAll("circle")
    .each(function (d) {
      prevPositions.set(d.town_name, {
        cx: +this.getAttribute("cx"),
        cy: +this.getAttribute("cy"),
      });
    });

  // detect model switch — trails only on model change, not on town selection change
  const isModelSwitch =
    _prevScatterModel !== null && _prevScatterModel !== metricEngine.model;
  _prevScatterModel = metricEngine.model;

  // fixed 0–1 domain: both axes are percentile ranks → clean 0%–100% scale
  const x = d3
    .scaleLinear()
    .domain([0, 1])
    .range([margin.left, width - margin.right]);

  const y = d3
    .scaleLinear()
    .domain([0, 1])
    .range([height - margin.bottom, margin.top]);

  // get medians (exclude zero-funding towns from funding median to avoid skew)
  const xMed = d3.median(data, (d) => d.need);
  const yMed = d3.median(
    data.filter((d) => d.funding > 0),
    (d) => d.funding,
  );

  // snap-update all static elements (axes, labels, median lines, any leftover trails)
  svg
    .selectAll(
      ".x-axis, .y-axis, .x-label, .y-label, .median-line, .quadrant-labels, .trails",
    )
    .remove();

  // axes with percentage labels, styled ticks, and axis titles
  svg
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickFormat(d3.format(".0%")));

  svg
    .append("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).tickFormat(d3.format(".0%")));

  svg
    .append("text")
    .attr("class", "x-label")
    .attr("x", margin.left + (width - margin.left - margin.right) / 2)
    .attr("y", height - 8)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .attr("fill", "#555")
    .text("Flood risk & vulnerability (overall need percentile)");

  svg
    .append("text")
    .attr("class", "y-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -(margin.top + (height - margin.top - margin.bottom) / 2))
    .attr("y", 12)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .attr("fill", "#555")
    .text("Mitigation funding per resident (percentile)");

  // median lines to divide quadrants
  svg
    .append("line")
    .attr("class", "median-line")
    // .attr("x1", x(xMed))
    // .attr("x2", x(xMed))
    .attr("x1", x(0.5))
    .attr("x2", x(0.5))
    .attr("y1", margin.top)
    .attr("y2", height - margin.bottom)
    .attr("stroke", "#999")
    .attr("stroke-dasharray", "4");

  svg
    .append("line")
    .attr("class", "median-line")
    // .attr("y1", y(yMed))
    // .attr("y2", y(yMed))
    .attr("y1", y(0.5))
    .attr("y2", y(0.5))
    .attr("x1", margin.left)
    .attr("x2", width - margin.right)
    .attr("stroke", "#999")
    .attr("stroke-dasharray", "4");

  // draw movement trails on model switch: thin lines from old position → new position
  if (isModelSwitch && prevPositions.size > 0) {
    const trailsGroup = svg
      .insert("g", "g.dots") // insert below dots so circles sit on top
      .attr("class", "trails")
      .attr("opacity", 1);

    data.forEach((d) => {
      const prev = prevPositions.get(d.town_name);
      if (!prev) return;
      const newCx = x(d.need);
      const newCy = d.funding > 0 ? y(d.funding) : y(0);
      if (Math.hypot(newCx - prev.cx, newCy - prev.cy) < 4) return; // skip trivial moves
      trailsGroup
        .append("line")
        .attr("x1", prev.cx)
        .attr("y1", prev.cy)
        .attr("x2", newCx)
        .attr("y2", newCy)
        .attr("stroke", quadrantColors[d.quadrant] ?? "#aaa")
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.4);
    });

    // fade out after circle transition completes
    trailsGroup
      .transition()
      .delay(350)
      .duration(500)
      .attr("opacity", 0)
      .remove();
  }

  // persistent dots group — create once, raise above median lines after each static redraw
  let dotsGroup = svg.select("g.dots");
  if (dotsGroup.empty()) {
    dotsGroup = svg.append("g").attr("class", "dots");
  }
  dotsGroup.raise(); // the SVG equivalent of z-index: ensure dots are above static elements for better interactivity

  // create tooltip
  const tooltip = getScatterTooltip();

  // keyed join by town_name so D3 can match circles across renders and transition them
  dotsGroup
    .selectAll("circle")
    .data(data, (d) => d.town_name)
    .join(
      // first render: fade in circles from zero with transition
      (enter) =>
        enter
          .append("circle")
          .call((c) => c.append("title")) // add tooltip slot on enter
          .attr("cx", (d) => x(d.need))
          .attr("cy", (d) => (d.funding > 0 ? y(d.funding) : y(0)))
          .attr("fill", (d) => quadrantColors[d.quadrant] ?? "#888")
          .attr("stroke", (d) =>
            d.town_name === selectedTown ? "#000" : "none",
          )
          .attr("stroke-width", (d) => (d.town_name === selectedTown ? 2 : 0))
          .attr("r", 0)
          .attr("opacity", 0)
          .call((enter) =>
            enter
              .transition()
              .duration(400)
              .attr("r", (d) =>
                d.town_name === selectedTown
                  ? 7
                  : Math.sqrt(d.population) * 0.05,
              )
              .attr("opacity", (d) =>
                selectedTown === "top" || d.town_name === selectedTown
                  ? 0.9
                  : 0.3,
              ),
          ),
      // subsequent renders: transition existing circles to new positions and styles based on updated model values
      (update) =>
        update
          .transition()
          .duration(400)
          .attr("cx", (d) => x(d.need))
          .attr("cy", (d) => (d.funding > 0 ? y(d.funding) : y(0)))
          .attr("r", (d) =>
            d.town_name === selectedTown ? 7 : Math.sqrt(d.population) * 0.05,
          )
          .attr("fill", (d) => quadrantColors[d.quadrant] ?? "#888")
          .attr("stroke", (d) =>
            d.town_name === selectedTown ? "#000" : "none",
          )
          .attr("stroke-width", (d) => (d.town_name === selectedTown ? 2 : 0))
          .attr("opacity", (d) =>
            selectedTown === "top" || d.town_name === selectedTown ? 0.9 : 0.3,
          ),
    )
    .on("click", (event, d) => {
      // select town in dropdown on click to update dashboard
      const dropdown = document.getElementById("towns-dropdown");
      dropdown.value = d.town_name;
      dropdown.dispatchEvent(new Event("change"));

      // show click tooltip (works on mobile where <title> hover doesn't)
      const needPct = d3.format(".0%")(d.need);
      const fundPct = d3.format(".0%")(d.funding);
      const fundAmt =
        d.funding_pc > 0
          ? ` &nbsp;·&nbsp; $${Math.round(d.funding_pc).toLocaleString()}/resident`
          : "";
      tooltip.innerHTML = `<strong>${d.town_name}</strong><br>Need: ${needPct}<br>Funding: ${fundPct}${fundAmt}`;
      tooltip.style.left =
        Math.min(event.clientX + 12, window.innerWidth - 240) + "px";
      tooltip.style.top = event.clientY - 52 + "px";
      tooltip.style.display = "block";
      event.stopPropagation(); // prevent document click handler from immediately hiding it
    });

  // update <title> tooltip text on all circles after join
  dotsGroup
    .selectAll("circle")
    .select("title")
    .text(
      (d) =>
        d.town_name +
        "\nNeed: " +
        d3.format(".0%")(d.need) +
        "\nFunding: " +
        d3.format(".0%")(d.funding) +
        (d.funding_pc > 0
          ? " ($" + Math.round(d.funding_pc).toLocaleString() + "/resident)"
          : ""),
    );

  // quadrant labels — appended after dotsGroup.raise() so they sit on top
  addQuadrantLabels(svg, x, y, xMed, yMed, width, height, margin);
}

// add quadrant labels to scatter plot with halo effect for legibility over colored circles
function addQuadrantLabels(svg, x, y, xMed, yMed, width, height, margin) {
  // calculate plot bounds for dynamic label positioning
  const [xMin, xMax] = x.domain();
  const [yMin, yMax] = y.domain();
  // position labels based on median lines
  const labels = [
    {
      text: quadrantLabels.aligned,
      x: xMed + 0.75 * (xMax - xMed),
      y: yMed + 0.95 * (yMax - yMed),
    },
    {
      text: quadrantLabels.underfunded,
      x: xMed + 0.75 * (xMax - xMed),
      y: yMed - 0.5 * (yMed - yMin),
    },
    {
      text: quadrantLabels.overfunded,
      x: xMed - 0.75 * (xMed - xMin),
      y: yMed + 0.95 * (yMax - yMed),
    },
    {
      text: quadrantLabels.low_priority,
      x: xMed - 0.75 * (xMed - xMin),
      y: yMed - 0.5 * (yMed - yMin),
    },
    {
      text: quadrantLabels.zero_funding,
      x: xMed,
      y: yMed - 0.95 * (yMed - yMin),
    },
  ];

  // add labels to plot with halo effect for legibility over colored circles
  // paint-order:stroke fill renders the white stroke behind the dark fill — no double-render needed
  svg
    .append("g")
    .attr("class", "quadrant-labels")
    .selectAll("text")
    .data(labels)
    .join("text")
    .attr("x", (d) => x(d.x))
    .attr("y", (d) => y(d.y))
    .attr("font-size", "11.5px")
    .attr("font-weight", "600")
    .attr("fill", "#222")
    .attr("stroke", "rgba(255,255,255,0.88)")
    .attr("stroke-width", "3.5px")
    .attr("stroke-linejoin", "round")
    .style("paint-order", "stroke fill")
    .attr("text-anchor", "middle")
    .text((d) => d.text);
}
