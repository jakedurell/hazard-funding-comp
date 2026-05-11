// Description: This file contains functions to initialize and render the rankings table based on the selected metric and town.

// globals to store rankings data and VT baseline for relative metrics
let rankingsData = [];
let vtBaseline = {};

// base metric key → display label (sourced from config.js)
const reverseMetricMap = baseToOverlay;

// module-level scroll targets updated on each render — read by wireRankingJumps buttons
let _vtScrollTop = null;
let _selectedScrollTop = null;
let _zeroScrollTop = null;
let _vtScrollBottom = null;

// initialize rankings data and VT baseline
function initializeRankings(data) {
  rankingsData = data;
  vtBaseline = data.find((d) => d.town_name === "State of Vermont");
}

// wire jump buttons once after DOM loads (call from app.js after initializeRankings)
function wireRankingJumps() {
  const containerEl = document.getElementById("rankings-container");
  if (!containerEl) return;

  document.getElementById("jump-top")?.addEventListener("click", () => {
    containerEl.scrollTop = 0;
  });
  document.getElementById("jump-vt")?.addEventListener("click", () => {
    if (metricEngine.isRelative) {
      if (_zeroScrollTop !== null) containerEl.scrollTop = _zeroScrollTop;
    } else {
      if (_vtScrollTop !== null) containerEl.scrollTop = _vtScrollTop;
    }
  });
  document.getElementById("jump-selected")?.addEventListener("click", () => {
    if (_selectedScrollTop !== null) containerEl.scrollTop = _selectedScrollTop;
  });
  document.getElementById("jump-bottom")?.addEventListener("click", () => {
    containerEl.scrollTop = containerEl.scrollHeight;
  });
}

// render rankings table based on selected metric and town
function renderRankings(metric, isRelative, selectedTown) {
  // get container element for rendering and scroll calculations
  const container = d3.select("#rankings-container");
  const containerEl = container.node();

  // ── resolve keys and title ──────────────────────────────────────────────────

  // populate title (before resolving metric)
  const baseMetric = metricEngine.baseMetric;
  const title = reverseMetricMap[baseMetric] || baseMetric;
  document.getElementById("rankings-title").textContent = title;

  // get appropriate keys for current metric and ranking, and derive raw value key for labels
  const metricKey = metricEngine.getMetricKey();
  const rankKey = metricEngine.getRankKey();
  const rawKey = metricKey
    .replace(/^(\w+)_rank_(.+)$/, "$1_$2") // swaps a middle "_rank_" with "_" if present
    .replace(/_rank$/, "") // strips a trailing "_rank" if present
    .replace(/^funding$/, "funding_per_capita") // funding_rank → funding_per_capita for display
    .replace(/^claims$/, "claims_paid_per_capita"); // claims_rank → claims_paid_per_capita for display

  // populate dynamic blurb below the title
  const blurbEl = document.getElementById("rankings-blurb");
  if (blurbEl) {
    const modelLabel =
      modelKeyToLabel[metricEngine.model] ?? metricEngine.model;
    const n = rankingsData.filter(
      (d) => d.town_name !== "State of Vermont" && +d.population > 0,
    ).length;

    // metrics that don't use a model (funding, vulnerability, claims) skip the model qualifier
    const modelQualifier = ["funding", "vulnerability", "claims"].includes(
      baseMetric,
    )
      ? " · model independent"
      : ` · ${modelLabel} model`;

    if (selectedTown && selectedTown !== "top") {
      // town selected: show its rank and relative distance from VT average
      const townRow = rankingsData.find((d) => d.town_name === selectedTown);
      const rankVal = townRow ? +townRow[rankKey] : null;
      if (rankVal !== null && !isNaN(rankVal)) {
        const rankPct = Math.round(rankVal * 100);
        const rankNum = Math.round(rankVal * n);
        const relVal = townRow ? +townRow[metricKey] : null;
        if (isRelative && !isNaN(relVal)) {
          // relative mode: show % above/below VT average
          const sign = relVal >= 0 ? "+" : "";
          blurbEl.textContent = `${selectedTown} is ${sign}${Math.round(relVal * 100)}% vs. VT average${modelQualifier}`;
        } else {
          // rank mode: show numeric rank and percentile
          blurbEl.textContent = `${selectedTown} ranks ${rankNum} of ${n} towns — higher than ${rankPct}% of towns${modelQualifier}`;
        }
      } else {
        blurbEl.textContent = "";
      }
    } else if (isRelative) {
      // relative mode, no town: show above/below split
      const aboveCount = rankingsData.filter(
        (d) =>
          d.town_name !== "State of Vermont" &&
          +d.population > 0 &&
          +d[metricKey] >= 0,
      ).length;
      blurbEl.textContent = `${aboveCount} towns above average · ${n - aboveCount} below${modelQualifier}`;
    } else {
      // rank mode, no town: show how many rank above VT average
      const vtVal = vtBaseline ? +vtBaseline[rawKey] : null;
      if (vtVal !== null && !isNaN(vtVal)) {
        const aboveVT = rankingsData.filter(
          (d) =>
            d.town_name !== "State of Vermont" &&
            +d.population > 0 &&
            +d[rawKey] > vtVal,
        ).length;
        blurbEl.textContent = `${aboveVT} of ${n} towns rank above the Vermont average${modelQualifier}`;
      } else {
        blurbEl.textContent = "";
      }
    }
  }

  // ── prepare and sort town data ──────────────────────────────────────────────

  // prepare data: filter out VT, convert values to numbers, sort by pre-computed rank
  const townData = rankingsData
    .filter((d) => d.town_name !== "State of Vermont")
    .filter((d) => d.population > 0) // filter out towns with zero population to avoid skewing rankings
    .map((d) => ({
      ...d,
      value: +d[metricKey],
      rank: rankKey ? +d[rankKey] : null,
    }));

  // sort descending: rank 1.0 (highest/worst) at top for all metrics
  if (rankKey) {
    townData.sort((a, b) => b.value - a.value);
  }

  // compute scale for bar widths based on min/max values in the current metric
  const values = townData.map((d) => d.value);
  const max = d3.max(values);
  const min = d3.min(values);

  // set diverging or sequential scale based on relative vs rank mode
  const scale = isRelative
    ? d3.scaleLinear().domain([min, 0, max]).range([0, 50, 100])
    : d3.scaleLinear().domain([0, max]).range([0, 100]);

  // ── bind rows (enter / exit / merge) ───────────────────────────────────────

  // bind data to rows by town name (unique identifier) for efficient re-rendering
  const rows = container
    .selectAll(".rank-row")
    .data(townData, (d) => d.town_name);
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

  // ── update row content (rank, name, value label) ───────────────────────────

  // capture selected row scroll position for jump button
  const selectedRow = container.select(".rank-row.selected").node();
  _selectedScrollTop = selectedRow
    ? selectedRow.offsetTop -
      containerEl.clientHeight / 2 +
      selectedRow.offsetHeight / 2
    : null;

  // update rank, name, and value label for all rows
  rowsMerge
    .select(".rank-col")
    .text((d) => metricEngine.format(rankKey, +d[rankKey]));
  rowsMerge.select(".name-col").text((d) => d.town_name);
  rowsMerge
    .select(".value-label")
    .text((d) => metricEngine.format(rawKey, +d[rawKey]));

  // ── render bars ────────────────────────────────────────────────────────────

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

  // ── scroll targets (vt reference line + zero crossover) ───────────────────

  // in relative mode, find the zero-crossover row for scroll targeting
  _zeroScrollTop = null;
  if (isRelative) {
    const crossoverIdx = townData.findIndex((d) => d.value < 0);
    if (crossoverIdx >= 0) {
      const rowNodes = container.selectAll(".rank-row").nodes();
      const crossoverRow = rowNodes[crossoverIdx];
      if (crossoverRow) {
        _zeroScrollTop = crossoverRow.offsetTop - containerEl.clientHeight / 2;
      }
    }
  }

  // remove existing VT reference line and label
  container.selectAll(".vt-ref-line, .vt-ref-label").remove();

  // tracks the pixel offset of the VT ref line so scroll logic can center on it
  let vtTopPx = null;

  // add reference line for VT baseline if in rank mode
  if (!isRelative && vtBaseline) {
    // get value and label, handling special case for funding metric
    if (!isRelative && vtBaseline) {
      let vtValue;
      let vtLabel = "VT";
      // use funding_rank to identify non-zero funded towns; take median of their funding_total as VT reference
      if (metricKey === "funding_rank") {
        const nonZero = townData.filter((d) => +d.funding_rank > 0);
        vtValue = d3.median(nonZero, (d) => +d.funding_per_capita);
        vtLabel = "Median funded town";
        // otherwise just take the value
      } else {
        vtValue = vtBaseline[rawKey];
      }

      // sorted towns by raw metric value to compute VT's position in the descending rank list
      const sortedValues = townData
        .map((d) => +d[rawKey])
        .filter((v) => !isNaN(v))
        .sort(d3.ascending);

      // all metrics sort descending (highest at top): towns above VT = those with value > vtValue
      const vtIndex =
        sortedValues.length - d3.bisectLeft(sortedValues, vtValue);

      // place reference line at the actual pixel position of the vtIndex-th row
      const rowNodes = container.selectAll(".rank-row").nodes();
      const vtRow = rowNodes[vtIndex];
      if (vtRow) {
        // subtract 1px to center the 2px line on the boundary between rows
        const topPx = vtRow.offsetTop - 1;
        vtTopPx = topPx;
        _vtScrollTop = topPx - containerEl.clientHeight / 2;

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

  // ── jump button state ────────────────────────────────────────────────────────

  // enable "My Town" only when a town is selected and has a scroll target
  const jumpSelectedBtn = document.getElementById("jump-selected");
  if (jumpSelectedBtn) {
    jumpSelectedBtn.disabled =
      !selectedTown || selectedTown === "top" || _selectedScrollTop === null;
  }

  // label "VT avg" in rank mode, "Zero" in relative mode
  const jumpVtBtn = document.getElementById("jump-vt");
  if (jumpVtBtn) jumpVtBtn.textContent = isRelative ? "Zero" : "VT avg";

  // ── auto-scroll ────────────────────────────────────────────────────────────

  // scroll the container to bring the relevant position into view
  if (_selectedScrollTop !== null && selectedTown && selectedTown !== "top") {
    // selected town: center its highlighted row
    containerEl.scrollTop = _selectedScrollTop;
  } else if (!isRelative && _vtScrollTop !== null) {
    // rank mode, no town selected: center on the VT reference line
    containerEl.scrollTop = _vtScrollTop;
  } else if (isRelative && _zeroScrollTop !== null) {
    // relative mode, no town selected: center on the zero crossover
    containerEl.scrollTop = _zeroScrollTop;
  }
}
