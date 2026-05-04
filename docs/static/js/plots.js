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
  clearPlotContainer();
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

// utility to clear plot container before rendering a new plot
function clearPlotContainer() {
  const container = document.getElementById("plot-container");
  container.innerHTML = "";
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

  return Object.entries(statsByTown)
    .filter(([, d]) => d.town_name !== "State of Vermont")
    .map(([town, d]) => ({
      town_name: town,
      need: +d[`need_${model}`],
      funding: Math.log1p(+d.funding_total),
      quadrant: d[quadKey],
      population: +d.population || 0,
    }))
    .filter((d) => !isNaN(d.need) && !isNaN(d.funding));
}

// render quadrant scatter plot with median lines and interactive labels based on current model, highlighting selected town
function renderQuadrantScatter(selectedTown) {
  // build data for current model
  const data = buildScatterData(metricEngine.model);

  // set up SVG canvas dimensions and margins
  const container = document.getElementById("plot-container");
  container.innerHTML = ""; // clear
  const width = container.clientWidth;
  const height = 420;
  const margin = { top: 40, right: 20, bottom: 50, left: 60 };

  // create SVG element for D3 plotting
  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  // scales
  const x = d3
    .scaleLinear()
    .domain(d3.extent(data, (d) => d.need))
    .nice()
    .range([margin.left, width - margin.right]);

  const y = d3
    .scaleLinear()
    .domain(d3.extent(data, (d) => d.funding))
    .nice()
    .range([height - margin.bottom, margin.top]);

  // medians (exclude zero-funding towns to avoid median skew)
  const xMed = d3.median(data, (d) => d.need);
  const yMed = d3.median(
    data.filter((d) => d.funding > 0),
    (d) => d.funding,
  );

  // axes
  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x));

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(
      d3
        .axisLeft(y)
        .tickFormat((v) => (v === 0 ? "$0" : d3.format("$.1s")(Math.expm1(v)))),
    );

  // median lines
  svg
    .append("line")
    .attr("x1", x(xMed))
    .attr("x2", x(xMed))
    .attr("y1", margin.top)
    .attr("y2", height - margin.bottom)
    .attr("stroke", "#999")
    .attr("stroke-dasharray", "4");

  svg
    .append("line")
    .attr("y1", y(yMed))
    .attr("y2", y(yMed))
    .attr("x1", margin.left)
    .attr("x2", width - margin.right)
    .attr("stroke", "#999")
    .attr("stroke-dasharray", "4");

  // points
  svg
    .append("g")
    .selectAll("circle")
    .data(data)
    .join("circle")
    .attr("cx", (d) => x(d.need))
    .attr("cy", (d) => y(d.funding))
    // .attr("r", (d) => (d.town_name === selectedTown ? 6 : 3)) // highlight selected town with larger radius
    .attr("r", (d) =>
      d.town_name === selectedTown ? 7 : Math.sqrt(d.population) * 0.05,
    ) // scale radius by population
    .attr("fill", (d) => quadrantColors[d.quadrant] ?? "#888")
    .attr("stroke", (d) => (d.town_name === selectedTown ? "#000" : "none"))
    .attr("stroke-width", (d) => (d.town_name === selectedTown ? 2 : 0))
    .attr("opacity", (d) =>
      selectedTown === "top" || d.town_name === selectedTown ? 0.9 : 0.3,
    )
    // on click, set dropdown to selected town and trigger change event to update map and stats card
    .on("click", (_, d) => {
      const dropdown = document.getElementById("towns-dropdown");
      dropdown.value = d.town_name;
      dropdown.dispatchEvent(new Event("change"));
    })
    // hover tooltip
    .append("title")
    .text(
      (d) =>
        d.town_name +
        "\n" +
        "Need: " +
        d.need.toFixed(2) +
        "\n" +
        "Funding: $" +
        Math.round(Math.expm1(d.funding)).toLocaleString(),
    );

  // add quadrant annotations
  addQuadrantLabels(svg, x, y, xMed, yMed, width, height, margin);
}

function addQuadrantLabels(svg, x, y, xMed, yMed, width, height, margin) {
  // calculate plot bounds for dynamic label positioning
  const [xMin, xMax] = x.domain();
  const [yMin, yMax] = y.domain();
  // position lables based on median lines
  const labels = [
    {
      text: "Overfunded",
      x: xMed + 0.75 * (xMax - xMed),
      y: yMed + 0.95 * (yMax - yMed),
    },
    {
      text: "Underfunded",
      x: xMed + 0.75 * (xMax - xMed),
      y: yMed - 0.5 * (yMed - yMin),
    },
    {
      text: "Low Priority",
      x: xMed - 0.75 * (xMed - xMin),
      y: yMed + 0.95 * (yMax - yMed),
    },
    {
      text: "Aligned",
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
