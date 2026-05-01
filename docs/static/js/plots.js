// Description: JavaScript file for creating plots

// global to store current Chart.js instance for cleanup before rendering new plots
let currentChart = null;

// render plot based on selected metric and neighborhood
function renderPlot(metric, selectedNeighborhood) {
  clearPlotContainer();

  switch (metric) {
    // case "license_compliance":
    //   renderMinimumNightsPlot(selectedNeighborhood);
    //   break;

    // case "median_price":
    //   renderPriceDistribution(selectedNeighborhood);
    //   break;

    // case "reviews_per_month":
    //   renderOccupancyPlot(selectedNeighborhood);
    //   break;

    // case "multi_listing_pct":
    //   renderHostConcentrationLorenz(selectedNeighborhood);
    //   break;

    // case "listings_per_1000":
    //   renderListingDensityPlot(selectedNeighborhood);
    //   break;

    // case "total_listings":
    //   renderConcentrationPareto(selectedNeighborhood);
    //   break;

    default:
      renderPlaceholder();
  }

  // show metric definition, plot title, and caption based on selected metric
  showMetricDefinition(metric);
  // showPlotTitle(metric);
  // showPlotCaption(metric);
}

// utility to clear plot container before rendering a new plot
function clearPlotContainer() {
  const container = document.getElementById("plot-container");
  container.innerHTML = ""; // Remove all children
  // add a canvas element for Chart.js plots (Plotly can render directly into the container)
  const canvas = document.createElement("canvas");
  canvas.id = "plot-canvas";
  container.appendChild(canvas);
}

// renders a placeholder message
function renderPlaceholder() {
  document.getElementById("plot-container").innerHTML =
    "<div style='text-align:center;color:#888;'>No plot selected</div>";
}

// toggle visibility of metric definitions based on selected metric
function showMetricDefinition(metricKey) {
  const all = document.querySelectorAll(".metric-definition");
  all.forEach((el) => (el.style.display = "none"));
  const sel = document.getElementById("def-" + metricKey);
  if (sel) sel.style.display = "block";
}

// // predefined plot titles for each metric key
// const plotTitles = {
//   license_compliance: "Minimum Stay Patterns by License Status",
//   median_price: "Where Prices Cluster (Typical Nightly Cost)",
//   reviews_per_month: "Booking Intensity: Availability vs Review Activity",
//   multi_listing_pct: "Host Revenue Concentration (Who Controls Earnings?)",
//   listings_per_1000: "Listings per 1,000 Residents — Density vs Scale",
//   total_listings: "How Supply Concentrates Across Neighborhoods",
// };

// // toggle plot title based on selected metric
// function showPlotTitle(metricKey) {
//   const titleDiv = document.getElementById("plot-title");
//   titleDiv.textContent = plotTitles[metricKey] || "";
// }

// // toggle visibility of plot captions based on selected metric
// function showPlotCaption(metricKey) {
//   const all = document.querySelectorAll(".plot-caption");
//   all.forEach((el) => (el.style.display = "none"));
//   const sel = document.getElementById("caption-" + metricKey);
//   if (sel) sel.style.display = "block";
// }

//////////////////////////////////////////////////////////
