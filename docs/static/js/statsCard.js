// Description: JS for populating stats card

// render stats card for a given town (or statewide if "top" is passed)
function renderStatsCard(town) {
  const stats = statsByTown[town === "top" ? "State of Vermont" : town];
  if (!stats) return;

  const nameEl = document.getElementById("stats-town-name");
  nameEl.textContent =
    town === "top" ? "State of Vermont Snapshot" : `${town} Snapshot`;

  // show note for zero-population towns
  const zeroPop = +stats.population === 0;
  const noteEl = document.getElementById("stats-zero-pop-note");
  if (noteEl) noteEl.style.display = zeroPop ? "block" : "none";

  const model = metricEngine.model;

  // helpers (with safety checks ensuring type, handling missing/invalid data)
  const fmtPct = (v) => {
    if (v == null || v === "") return "—";
    const num = Number(v);
    return Number.isFinite(num) ? `${num.toFixed(0)}%` : "—";
  };

  const fmtNum = (v) => {
    if (v == null || v === "") return "—";
    const num = Number(v);
    return Number.isFinite(num) ? num.toLocaleString() : "—";
  };

  const fmtIdx = (v) => {
    if (v == null || v === "") return "—";
    const num = Number(v);
    return Number.isFinite(num) ? num.toFixed(2) : "—";
  };

  const fmtRatio = (v) => {
    if (v == null || v === "") return "—";
    const num = Number(v);
    return Number.isFinite(num) ? `${num.toFixed(2)}x` : "—";
  };

  // dynamic keys
  const riskKey = `risk_${model}`;
  const needKey = `need_${model}`;
  const gapKey = `gap_${model}`;
  const quadKey = `quadrant_${model}`;
  const riskVsKey = `${riskKey}_rel`;

  // --- populate ---
  document.getElementById("stat-risk").textContent = fmtIdx(stats[riskKey]);

  document.getElementById("stat-risk-vs").textContent = fmtRatio(
    stats[riskVsKey],
  );

  document.getElementById("stat-corridor").textContent = fmtPct(
    stats.pct_river_corridor,
  );

  document.getElementById("stat-vuln").textContent = fmtIdx(
    stats.vulnerability,
  );

  document.getElementById("stat-poverty").textContent = fmtPct(
    stats.pct_below_poverty,
  );

  document.getElementById("stat-elderly").textContent = fmtPct(
    stats.percent_elderly,
  );

  document.getElementById("stat-funding-total").textContent = fmtNum(
    stats.funding_total,
  );

  document.getElementById("stat-funding-pc").textContent = fmtNum(
    stats.funding_per_capita,
  );

  document.getElementById("stat-funding-rank").textContent = fmtNum(
    stats.funding_rank,
  );

  document.getElementById("stat-need").textContent = fmtIdx(stats[needKey]);

  document.getElementById("stat-gap").textContent = fmtIdx(stats[gapKey]);

  // headline insight
  document.getElementById("stats-quadrant").textContent = stats[quadKey]
    ? stats[quadKey].replace(/_/g, " ")
    : "—";
}
