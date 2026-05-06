// Description: This file contains functions to initialize and render the rankings table based on the selected metric and town.

// globals to store rankings data and VT baseline for relative metrics
let rankingsData = [];
let vtBaseline = {};

// for rankings title
reverseMetricMap = {
  risk: "Risk",
  vulnerability: "Social Vulnerability",
  need: "Need Index",
  funding: "Funding",
  gap: "Gap (Funding vs Need)",
  // total_listings: "Total Listings",
};

// initialize rankings data and VT baseline
function initializeRankings(data) {
  rankingsData = data;
  vtBaseline = data.find((d) => d.town_name === "State of Vermont");
}

// render rankings table based on selected metric and town
function renderRankings(metric, isRelative, selectedTown) {
  const container = d3.select("#rankings-container");

  // populate title (before resolving metric)
  const baseMetric = metricEngine.baseMetric;
  const title = reverseMetricMap[baseMetric] || baseMetric;
  document.getElementById("rankings-title").textContent = title;

  // get appropriate keys for current metric and ranking, and derive raw value key for labels
  const metricKey = metricEngine.getMetricKey();
  const rankKey = metricEngine.getRankKey();
  const rawKey = metricKey
    .replace(/^(\w+)_rank_(.+)$/, "$1_$2") // swaps a middle "_rank_" with "_" if present
    .replace(/_rank$/, ""); // strips a trailing "_rank" if present

  // prepare data: filter out VT, convert values to numbers, sort by pre-computed rank
  const towns = rankingsData
    .filter((d) => d.town_name !== "State of Vermont")
    .filter((d) => d.population > 0) // filter out towns with zero population to avoid skewing rankings
    .map((d) => ({
      ...d,
      value: +d[metricKey],
      rank: rankKey ? +d[rankKey] : null,
    }));

  // sort by rank if available
  if (rankKey) {
    towns.sort((a, b) => a.value - b.value); // sort by actual value, not rank
  }

  // compute scale for bar widths based on min/max values in the current metric
  const values = towns.map((d) => d.value);
  const max = d3.max(values);
  const min = d3.min(values);

  // set diverging or sequential scale based on relative vs rank mode
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
  rowsMerge
    .select(".rank-col")
    .text((d) => metricEngine.format(rankKey, +d[rankKey]));
  rowsMerge.select(".name-col").text((d) => d.town_name);
  rowsMerge
    .select(".value-label")
    .text((d) => metricEngine.format(rawKey, +d[rawKey]));

  // update bar widths and positions based on metric values and relative vs rank mode
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
      // rank mode with sequential bars
    } else {
      // hide diverging zero line
      zeroLine.style("display", "none");

      bar
        .attr("class", "bar rank")
        .style("left", "0%")
        .style("width", scale(d.value) + "%");
    }
  });

  // remove existing VT reference line and label
  container.selectAll(".vt-ref-line, .vt-ref-label").remove();

  // add reference line for VT baseline if in rank mode
  if (!isRelative && vtBaseline) {
    // get value and label, handling special case for funding metric
    if (!isRelative && vtBaseline) {
      let vtValue;
      let vtLabel = "VT";
      // backend uses geometric mean of non-zero funding: expm1(mean(log1p(x)))
      // log-transform non-zero values to compute mean, then reverse-transform to get VT baseline value for funding
      if (metricKey === "funding_total") {
        const nonZeroLogs = towns
          .filter((d) => +d.funding_total > 0)
          .map((d) => Math.log1p(+d.funding_total));
        vtValue = nonZeroLogs.length > 0 ? Math.expm1(d3.mean(nonZeroLogs)) : 0;
        vtLabel = "VT (geometric mean)";
        // otherwise just take the value
      } else {
        vtValue = vtBaseline[rawKey];
      }

      // sorted towns by raw metric value to compute VT's position in the rank list
      const sortedValues = towns
        .map((d) => +d[rawKey])
        .filter((v) => !isNaN(v))
        .sort(d3.ascending);

      // ascending metrics (funding, gap): low value = top of list, so towns above VT = those with value < vtValue
      // descending metrics (risk, need, vuln): high value = top of list, so towns above VT = those with value > vtValue
      const isAscending =
        metricEngine.baseMetric === "funding" ||
        metricEngine.baseMetric === "gap";
      const vtIndex = isAscending
        ? d3.bisectLeft(sortedValues, vtValue)
        : sortedValues.length - d3.bisectLeft(sortedValues, vtValue);

      // place reference line at appropriate position based on computed rank index and row heights
      const firstRow = container.select(".rank-row").node();
      if (firstRow) {
        // get row height, compute top position, subtract 1px to center the 2px line on the boundary between rows
        const rowHeight = firstRow.offsetHeight;
        const topPx = rowHeight * vtIndex - 1;

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
          .text(`${vtLabel}: ${metricEngine.format(rawKey, vtValue)}`);
      }
    }
  }
}
