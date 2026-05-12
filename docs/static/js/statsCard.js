// Description: JS for populating stats card

// render stats card for a given town (or statewide if "top" is passed)
function renderStatsCard(town) {
  const stats = statsByTown[town === "top" ? "State of Vermont" : town];
  if (!stats) return;

  // set town name in card header
  const nameEl = document.getElementById("stats-town-name");
  nameEl.textContent =
    town === "top" ? "State of Vermont Snapshot" : `${town} Snapshot`;

  // show note for zero-population towns
  const zeroPop = +stats.population === 0;
  const noteEl = document.getElementById("stats-zero-pop-note");
  if (noteEl) noteEl.style.display = zeroPop ? "block" : "none";

  // get current model from metric engine to determine which metric keys to use
  const model = metricEngine.model;

  // helpers (with safety checks ensuring type, handling missing/invalid data)
  const fmtPct = (v) => {
    if (v == null || v === "") return "—";
    const num = Number(v);
    return Number.isFinite(num) ? `${num.toFixed(0)}%` : "—";
  };
  const fmtInt = (v) => {
    if (v == null || v === "") return "\u2014";
    const num = Number(v);
    return Number.isFinite(num) ? num.toLocaleString("en-US") : "\u2014";
  };
  const fmtCurrency = (v) => {
    if (v == null || v === "") return "—";
    const num = Number(v);
    return Number.isFinite(num)
      ? `${num.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`
      : "—";
  };

  const fmtIdx = (v) => {
    if (v == null || v === "") return "—";
    const num = Number(v);
    return Number.isFinite(num) ? (num * 100).toFixed(0) + "%" : "—";
  };

  const fmtRel = (v) => {
    if (v == null || v === "") return "—";
    const num = Number(v);
    if (!Number.isFinite(num)) return "—";
    const pct = Math.round(Math.abs(num) * 100);
    return num >= 0 ? `${pct}% above` : `${pct}% below`;
  };

  const fmtGap = (v) => {
    if (v == null || v === "") return "—";
    const num = Number(v);
    if (!Number.isFinite(num)) return "—";

    const pct = Math.round(Math.abs(num) * 100);

    if (num > 0.05) return `${pct}% underfunded`;
    if (num < -0.05) return `${pct}% overfunded`;
    return "Roughly aligned";
  };

  // dynamic keys
  const quadKey = `quadrant_${model}`;
  const riskVsKey = `risk_${model}_rel`;
  const riskRankKey = `risk_rank_${model}`;
  const needRankKey = `need_rank_${model}`;
  const gapKey = `gap_${model}`;

  // headline insight
  const quadrant = stats[quadKey];
  document.getElementById("stats-quadrant").textContent = quadrant
    ? (quadrantHeadlines[quadrant] ?? quadrantLabels[quadrant] ?? quadrant)
    : "—";
  const summaryEl = document.getElementById("stats-summary");
  if (summaryEl) {
    summaryEl.textContent = quadrant ? (quadrantSummaries[quadrant] ?? "") : "";
  }

  // populate stats values, using helpers for formatting
  document.getElementById("stat-population").textContent = fmtInt(
    stats.population,
  );

  document.getElementById("stat-eal-raw").textContent = fmtCurrency(
    stats.IFLD_EALT_weighted,
  );

  document.getElementById("stat-eal-per-capita").textContent = fmtCurrency(
    stats.EAL_per_capita,
  );

  document.getElementById("stat-risk").textContent = fmtIdx(stats[riskRankKey]);

  document.getElementById("stat-risk-vs").textContent = fmtRel(
    stats[riskVsKey],
  );

  document.getElementById("stat-corridor").textContent = fmtPct(
    stats.pct_river_corridor,
  );

  document.getElementById("stat-vuln").textContent = fmtIdx(
    stats.vulnerability_rank,
  );

  document.getElementById("stat-poverty").textContent = fmtPct(
    stats.pct_below_poverty,
  );

  document.getElementById("stat-elderly").textContent = fmtPct(
    stats.percent_elderly,
  );

  document.getElementById("stat-no-vehicle").textContent = fmtPct(
    stats.pct_no_vehicle,
  );

  document.getElementById("stat-income").textContent = fmtCurrency(
    stats.median_income,
  );

  document.getElementById("stat-renter").textContent = fmtPct(
    stats.pct_renter_occupied,
  );

  document.getElementById("stat-funding-total").textContent = fmtCurrency(
    stats.funding_total,
  );

  document.getElementById("stat-funding-pc").textContent = fmtCurrency(
    stats.funding_per_capita,
  );

  document.getElementById("stat-funding-rank").textContent = fmtIdx(
    stats.funding_rank,
  );

  document.getElementById("stat-claims-pc").textContent = fmtCurrency(
    stats.claims_paid_per_capita,
  );

  document.getElementById("stat-need").textContent = fmtIdx(stats[needRankKey]);

  document.getElementById("stat-funding-rel").textContent = fmtRel(
    stats.funding_rel,
  );

  document.getElementById("stat-gap").textContent = fmtGap(stats[gapKey]);
}
