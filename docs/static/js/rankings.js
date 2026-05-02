// Description: This file contains functions to initialize and render the rankings table based on the selected metric and town.

// globals to store rankings data and VT baseline for relative metrics
let rankingsData = [];
let vtBaseline = {};
let avgTotalListings = null;

// for rankings title
reverseMetricMap = {
  gap: "Gap (Funding vs Need)",
  funding: "Funding",
  need: "Need Index",
  risk: "Risk",
  vulnerability: "Social Vulnerability",
  // total_listings: "Total Listings",
};

// initialize rankings data and VT baseline
function initializeRankings(data) {
  rankingsData = data;
  vtBaseline = data.find((d) => d.town_name === "State of Vermont");

  // Compute average total_listings for all towns except VT
  const towns = data.filter((d) => d.town_name !== "State of Vermont");
  avgTotalListings =
    towns.reduce((sum, d) => sum + (+d.total_listings || 0), 0) / towns.length;
}

// render rankings table based on selected metric and town
function renderRankings(metric, isRelative, selectedTown) {
  const container = d3.select("#rankings-container");

  // populate title (before resolving metric)
  const title = reverseMetricMap[metric] || metric;
  document.getElementById("rankings-title").textContent = title;

  // resolve metric key based on whether relative mode is toggled
  const metricKey = metricEngine.getMetricKey();

  // prepare data: filter out VT, convert values to numbers, sort by pre-computed rank
  const rankKey = metricEngine.getRankKey();
  const towns = rankingsData
    .filter((d) => d.town_name !== "State of Vermont")
    .map((d) => ({
      ...d,
      value: +d[metricKey],
      rank: rankKey ? +d[rankKey] : null,
    }));

  // sort by rank if available
  if (rankKey) {
    towns.sort((a, b) => a.rank - b.rank);
  }

  // compute scale for bar widths based on min/max values in the current metric
  const values = towns.map((d) => d.value);
  const max = d3.max(values);
  const min = d3.min(values);

  // set diverging or sequential scale based on relative vs absolute mode
  const scale = isRelative
    ? d3.scaleLinear().domain([min, 0, max]).range([0, 50, 100])
    : d3.scaleLinear().domain([0, max]).range([0, 100]);

  // bind data to rows by town name (unique identifier) for efficient re-rendering
  const rows = container.selectAll(".rank-row").data(towns, (d) => d.town_name);
  // remove old rows that are no longer in the data
  rows.exit().remove();

  // create new rows
  const rowsEnter = rows.enter().append("div").attr("class", "rank-row");
  rowsEnter.append("div").attr("class", "rank-col");
  rowsEnter.append("div").attr("class", "name-col");

  // create bar column with track, zero line, bar, and value label
  const barCol = rowsEnter.append("div").attr("class", "bar-col");
  barCol.append("div").attr("class", "bar-track");
  barCol.append("div").attr("class", "bar-zero-line");
  barCol.append("div").attr("class", "bar");
  barCol.append("span").attr("class", "value-label");

  // merge new and existing rows for update
  const rowsMerge = rowsEnter.merge(rows);

  // order rows by rank (dynamic reordering based on current metric)
  rowsMerge.order();

  // add click handler to rows to trigger town selection in dropdown and update other components
  rowsMerge.on("click", function (event, d) {
    const dropdown = document.getElementById("towns-dropdown");
    dropdown.value = d.town_name;
    dropdown.dispatchEvent(new Event("change"));
  });

  // highlight selected town
  rowsMerge.classed("selected", (d) => d.town_name === selectedTown);

  // update rank, name, and value label for all rows
  rowsMerge.select(".rank-col").text((d) => d.rank);
  rowsMerge.select(".name-col").text((d) => d.town_name);
  rowsMerge
    .select(".value-label")
    .text((d) => formatMetric(metricKey, d.value));

  // update bar widths and positions based on metric values and relative vs absolute mode
  rowsMerge.each(function (d) {
    const row = d3.select(this);
    const bar = row.select(".bar");
    const zeroLine = row.select(".bar-zero-line");

    // handle relative mode with diverging bars
    if (isRelative) {
      // show zero line in relative mode to separate positive vs negative values
      zeroLine.style("display", "block");

      // position bars based on whether value is positive or negative
      const center = 50;
      const scaled = scale(d.value);

      // if value is positive, bar grows to the right of center; if negative, bar grows to the left
      if (d.value >= 0) {
        bar
          .attr("class", "bar positive")
          .style("left", center + "%")
          .style("width", scaled - center + "%");
      } else {
        bar
          .attr("class", "bar negative")
          .style("left", scaled + "%")
          .style("width", center - scaled + "%");
      }
      // absolute mode with sequential bars
    } else {
      // hide diverging zero line
      zeroLine.style("display", "none");

      bar
        .attr("class", "bar absolute")
        .style("left", "0%")
        .style("width", scale(d.value) + "%");
    }
  });

  // remove existing VT reference line and label
  container.selectAll(".vt-ref-line, .vt-ref-label").remove();

  // add reference line for VT baseline if in absolute mode
  if (!isRelative && vtBaseline) {
    let vtValue,
      vtLabel = "VT";
    if (metricKey === "total_listings") {
      vtValue = avgTotalListings;
      vtLabel = "Avg";
    } else {
      vtValue = vtBaseline[metricKey];
    }

    // determine where VT would rank in the sorted towns
    const sortedValues = towns.map((d) => d.value);
    let vtRankIndex = sortedValues.findIndex((v) => v < vtValue);

    // if VT value is worse than all towns, place at end of list
    if (vtRankIndex === -1) {
      vtRankIndex = sortedValues.length;
    }

    // place reference line at appropriate position based on computed rank index and row heights
    const firstRow = container.select(".rank-row").node();
    if (firstRow) {
      // get row height, compute top position, subtract 1px to center the 2px line on the boundary between rows
      const rowHeight = firstRow.offsetHeight;
      const topPx = rowHeight * vtRankIndex - 1;

      // add reference line at computed position
      container
        .append("div")
        .attr("class", "vt-ref-line")
        .style("top", topPx + "px");

      // add value label
      container
        .append("div")
        .attr("class", "vt-ref-label")
        .style("top", topPx - 10 + "px")
        .text(`${vtLabel}: ${formatMetric(metricKey, vtValue)}`);
    }
  }
}
