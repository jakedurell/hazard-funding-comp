// Description: JavaScript file for creating plots

// model display names for plot subtitle
const modelDisplayNames = {
  eal: "Expected Annual Loss (EAL)",
  eal_per_capita: "EAL per Capita",
  nri: "FEMA National Risk Index",
};

// render plot based on selected metric and town
function renderPlot(metric, selectedTown) {
  showMetricDefinition(metric);
  renderQuadrantScatter(selectedTown);
  showPlotHeader(true);
  showPlotCaption();
}

// toggle visibility of metric definitions based on selected metric
function showMetricDefinition(metricKey) {
  const all = document.querySelectorAll(".metric-definition");
  all.forEach((el) => (el.style.display = "none"));
  const sel = document.getElementById("def-" + metricKey);
  if (sel) sel.style.display = "block";
}

// show/hide plot title and model subtitle
function showPlotHeader(visible) {
  const titleDiv = document.getElementById("plot-title");
  const subtitleDiv = document.getElementById("plot-subtitle");
  if (titleDiv) titleDiv.style.display = visible ? "block" : "none";
  if (subtitleDiv) {
    subtitleDiv.style.display = visible ? "block" : "none";
    subtitleDiv.textContent = visible
      ? `Model: ${modelDisplayNames[metricEngine.model] ?? metricEngine.model}`
      : "";
  }
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

// helper to build data array for scatter plot based on current model, with necessary transformations and filtering for valid numeric values
function buildScatterData(model) {
  const quadKey = `quadrant_${model}`;

  return statsRaw
    .filter((d) => d.town_name !== "State of Vermont")
    .map((d) => ({
      town_name: d.town_name,
      need: +d[`need_${model}`],
      funding: +d.funding_rank,
      funding_pc: +d.funding_per_capita,
      quadrant: d[quadKey],
      population: +d.population || 0,
    }))
    .filter((d) => !isNaN(d.need) && !isNaN(d.funding));
}

// render quadrant scatter plot with median lines and interactive labels based on current model, highlighting selected town
function renderQuadrantScatter(selectedTown) {
  const data = buildScatterData(metricEngine.model);
  const container = document.getElementById("plot-container");
  const width = container.clientWidth;
  const height = 420;
  const margin = { top: 40, right: 20, bottom: 50, left: 60 };

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

  // scales
  const x = d3
    .scaleLinear()
    .domain(d3.extent(data, (d) => d.need))
    .nice()
    .range([margin.left, width - margin.right]);

  const y = d3
    .scaleLinear()
    .domain(
      d3.extent(
        data.filter((d) => d.funding > 0),
        (d) => d.funding,
      ),
    )
    .nice()
    .range([height - margin.bottom, margin.top]);

  // medians (exclude zero-funding towns to avoid median skew)
  const xMed = d3.median(data, (d) => d.need);
  const yMed = d3.median(
    data.filter((d) => d.funding > 0),
    (d) => d.funding,
  );

  // snap-update all static elements (axes, lines, labels)
  svg
    .selectAll(".x-axis, .y-axis, .y-label, .median-line, .quadrant-labels")
    .remove();

  svg
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x));

  svg
    .append("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).tickFormat(d3.format(".0%")));

  svg
    .append("text")
    .attr("class", "y-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -(margin.top + (height - margin.top - margin.bottom) / 2))
    .attr("y", 12)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .attr("fill", "#555")
    .text("Funding per capita (percentile rank)");

  svg
    .append("line")
    .attr("class", "median-line")
    .attr("x1", x(xMed))
    .attr("x2", x(xMed))
    .attr("y1", margin.top)
    .attr("y2", height - margin.bottom)
    .attr("stroke", "#999")
    .attr("stroke-dasharray", "4");

  svg
    .append("line")
    .attr("class", "median-line")
    .attr("y1", y(yMed))
    .attr("y2", y(yMed))
    .attr("x1", margin.left)
    .attr("x2", width - margin.right)
    .attr("stroke", "#999")
    .attr("stroke-dasharray", "4");

  // persistent dots group — create once, raise above median lines after each static redraw
  let dotsGroup = svg.select("g.dots");
  if (dotsGroup.empty()) {
    dotsGroup = svg.append("g").attr("class", "dots");
  }
  dotsGroup.raise(); // the SVG equivalent of z-index: ensure dots are above static elements for better interactivity

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
          .attr("cy", (d) => (d.funding > 0 ? y(d.funding) : y(y.domain()[0])))
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
          .attr("cy", (d) => (d.funding > 0 ? y(d.funding) : y(y.domain()[0])))
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
    // add click handler to update selected town on click
    .on("click", (_, d) => {
      const dropdown = document.getElementById("towns-dropdown");
      dropdown.value = d.town_name;
      dropdown.dispatchEvent(new Event("change"));
    });

  // update tooltip text on all circles after join
  dotsGroup
    .selectAll("circle")
    .select("title")
    .text(
      (d) =>
        d.town_name +
        "\n" +
        "Need: " +
        d.need.toFixed(2) +
        "\n" +
        "Funding rank: " +
        d3.format(".0%")(d.funding) +
        (d.funding_pc > 0
          ? " ($" + Math.round(d.funding_pc).toLocaleString() + "/cap)"
          : ""),
    );

  // quadrant labels — appended after dotsGroup.raise() so they sit on top
  addQuadrantLabels(svg, x, y, xMed, yMed, width, height, margin);
}

function addQuadrantLabels(svg, x, y, xMed, yMed, width, height, margin) {
  // calculate plot bounds for dynamic label positioning
  const [xMin, xMax] = x.domain();
  const [yMin, yMax] = y.domain();
  // position lables based on median lines
  const labels = [
    {
      text: "Aligned",
      x: xMed + 0.75 * (xMax - xMed),
      y: yMed + 0.95 * (yMax - yMed),
    },
    {
      text: "Underfunded",
      x: xMed + 0.75 * (xMax - xMed),
      y: yMed - 0.5 * (yMed - yMin),
    },
    {
      text: "Overfunded",
      x: xMed - 0.75 * (xMed - xMin),
      y: yMed + 0.95 * (yMax - yMed),
    },
    {
      text: "Low Priority",
      x: xMed - 0.75 * (xMed - xMin),
      y: yMed - 0.5 * (yMed - yMin),
    },
    {
      text: "Zero Funding",
      x: xMed,
      y: yMed - 0.95 * (yMed - yMin),
    },
  ];

  // add labels to plot with styling and positioning
  svg
    .append("g")
    .attr("class", "quadrant-labels")
    .selectAll("text")
    .data(labels)
    .join("text")
    .attr("x", (d) => x(d.x))
    .attr("y", (d) => y(d.y))
    .attr("font-size", "11px")
    .attr("fill", "#555")
    .attr("text-anchor", "middle")
    .text((d) => d.text);
}
