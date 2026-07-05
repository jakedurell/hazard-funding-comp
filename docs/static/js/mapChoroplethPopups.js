// ==========================================================
// Map Choropleth Popups
//
// Generates hover tooltips and click popups for choropleth
// map features.
//
// Responsibilities:
// • Hover tooltip content
// • Popup content
// • Popup interaction helpers
// • Metric formatting helpers
//
// Technical debt remains from integrating hover labels and
// popups late in development. See docs/static/js/app.js for 
// context.
// ==========================================================

// helper to add note re: model to popups

// appends note to popups re: active model
function buildModelNote() {
  const model = metricEngine.model;
  const note = (text) =>
    `<hr class="popup-divider"><span class="popup-note">${text}</span>`;
  if (model === "eal_per_capita")
    return note(
      "Per-capita model surfaces smaller towns with concentrated exposure.",
    );
  if (model === "eal")
    return note(
      "Absolute loss model weights larger towns with more total exposure.",
    );
  if (model === "nri")
    return note("Based on FEMA's National Risk Index — a composite benchmark.");
  return "";
}

///////////////////////////////////////////////////////

// choropleth hover & popups

// short one-sentence hover tooltip — shown on mouseover, quickly scannable
function buildChoroplethHover(town) {
  const stats = statsByTown[town];
  if (!stats) return `<b>${town}</b>`;

  const base = metricEngine.baseMetric;
  const model = metricEngine.model;

  const pct = (key) => {
    const v = +stats[key];
    return Number.isFinite(v) ? Math.round(v * 100) : null;
  };

  if (base === "risk") {
    const rankPct = pct(`risk_rank_${model}`);
    return (
      `<b>${town}</b><br>` +
      (rankPct !== null
        ? `Projected flood exposure is higher than ${rankPct}% of Vermont towns.`
        : "Expected flood loss data unavailable.")
    );
  }

  if (base === "vulnerability") {
    const rankPct = pct("vulnerability_rank");
    if (rankPct !== null && rankPct >= 50)
      return `<b>${town}</b><br>Higher vulnerability than ${rankPct}% of Vermont towns.`;
    if (rankPct !== null)
      return `<b>${town}</b><br>Relatively lower social vulnerability than most Vermont towns.`;
    return `<b>${town}</b>`;
  }

  if (base === "need") {
    const rankPct = pct(`need_rank_${model}`);
    return (
      `<b>${town}</b><br>` +
      (rankPct !== null
        ? `Combined flood need ranks higher than ${rankPct}% of Vermont towns.`
        : "Combined need data unavailable.")
    );
  }

  if (base === "funding") {
    const hasFunding = +stats.funding_total > 0;
    const rankPct = pct("funding_rank");
    if (!hasFunding)
      return `<b>${town}</b><br>No recorded FEMA mitigation funding.`;
    return (
      `<b>${town}</b><br>` +
      (rankPct !== null
        ? `Received more mitigation funding than ${rankPct}% of Vermont towns.`
        : "Has received FEMA mitigation funding.")
    );
  }

  if (base === "gap") {
    const gapRank = pct(`gap_rank_${model}`);
    const needRank = pct(`need_rank_${model}`);
    const hasFunding = +stats.funding_total > 0;
    if (!hasFunding)
      return (
        `<b>${town}</b><br>` +
        (needRank >= 70
          ? "No recorded FEMA funding despite elevated flood need."
          : "No recorded FEMA mitigation funding.")
      );
    if (gapRank >= 70)
      return `<b>${town}</b><br>Appears underfunded relative to measured flood need.`;
    if (gapRank <= 30)
      return `<b>${town}</b><br>Has received more funding than its measured need would predict.`;
    return `<b>${town}</b><br>Funding levels appear broadly aligned with measured need.`;
  }

  if (base === "claims") {
    const rankPct = pct("claims_rank");
    if (rankPct !== null && rankPct >= 50)
      return `<b>${town}</b><br>Historical flood insurance claims rank higher than ${rankPct}% of Vermont towns.`;
    if (rankPct !== null)
      return `<b>${town}</b><br>Relatively limited NFIP claims history.`;
    return `<b>${town}</b>`;
  }

  return `<b>${town}</b>`;
}

// expanded click popup — full interpretation with notes, comparisons, and context
function buildChoroplethPopup(town) {
  const stats = statsByTown[town];
  // safety check in case stats are missing for this town (shouldn't happen)
  if (!stats) return `<b>${town}</b>`;

  const base = metricEngine.baseMetric;
  const model = metricEngine.model;

  // rank (0–1) → percentile integer; returns null if missing
  const pct = (key) => {
    const v = +stats[key];
    return Number.isFinite(v) ? Math.round(v * 100) : null;
  };

  // format currency values with safety checks
  const fmt$ = (v) => {
    const n = +v;
    if (!Number.isFinite(n) || n <= 0) return null;
    return n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  };

  // tooltip div
  const note = (text) => `<span class="popup-note">${text}</span>`;

  // render a row of narrative status tags at the top of the popup
  const tags = (...items) =>
    `<div class="popup-tags">${items.map(([variant, label]) => `<span class="popup-tag ${variant}">${label}</span>`).join("")}</div>`;

  // one-line model context note appended to model-aware popups
  const modelNote = () => buildModelNote();

  // conditionals for each metric to build popup content
  if (base === "risk") {
    // define variables
    const rankPct = pct(`risk_rank_${model}`);
    const ealPc = fmt$(stats.EAL_per_capita);
    const inCorridor = +stats.pct_river_corridor > 5;
    // tags
    let tagVariant = "neutral";
    let tagLabel = "DATA LIMITED";
    if (rankPct !== null) {
      tagVariant =
        rankPct >= 75 ? "danger" : rankPct >= 50 ? "warning" : "neutral";
      tagLabel =
        rankPct >= 75
          ? "HIGH EXPOSURE"
          : rankPct >= 50
            ? "ELEVATED EXPOSURE"
            : "LOWER EXPOSURE";
    }
    // html content
    let html = `<b>${town}</b>` + tags([tagVariant, tagLabel]);
    html +=
      rankPct !== null
        ? `Projected flood exposure is higher than ${rankPct}% of Vermont towns.`
        : "Expected flood loss data unavailable.";
    if (ealPc) html += note(`Est. annual flood loss: ${ealPc}/person`);
    if (inCorridor)
      html += note(
        "Large portions of town fall within mapped river corridors.",
      );
    html += modelNote();
    return html;
  }

  if (base === "vulnerability") {
    // define variables
    const rankPct = pct("vulnerability_rank");
    const poverty = +stats.pct_below_poverty;
    const elderly = +stats.percent_elderly;
    const no_vehicle = +stats.pct_no_vehicle;
    // html content with tags
    let html = `<b>${town}</b>`;
    if (rankPct !== null && rankPct >= 75)
      html += tags(["warning", "HIGH VULNERABILITY"]);
    else if (rankPct !== null && rankPct >= 50)
      html += tags(["warning", "ELEVATED VULNERABILITY"]);
    else html += `<br>`;
    if (rankPct !== null && rankPct >= 50) {
      html += `Residents may face greater difficulty recovering from floods.`;
      html += `<br>Higher vulnerability than ${rankPct}% of Vermont towns.`;
    } else if (rankPct !== null) {
      html += `Relatively lower social vulnerability than most Vermont towns.`;
    }
    // conditional notes on drivers of vulnerability
    const drivers = [];
    if (poverty > 15) drivers.push("higher poverty rates");
    if (elderly > 25) drivers.push("older resident populations");
    if (no_vehicle > 10) drivers.push("limited vehicle access");
    if (drivers.length === 1) {
      const single = {
        "higher poverty rates":
          "Higher poverty rates may limit recovery capacity.",
        "older resident populations":
          "Older residents may face additional evacuation and recovery challenges.",
        "limited vehicle access":
          "Limited vehicle access may constrain evacuation and recovery options.",
      };
      html += note(single[drivers[0]]);
    } else if (drivers.length >= 2) {
      const last = drivers.pop();
      const phrase = drivers.join(", ") + " and " + last;
      html += note(
        phrase.charAt(0).toUpperCase() +
          phrase.slice(1) +
          " may limit recovery and evacuation capacity.",
      );
    }
    return html;
  }

  if (base === "need") {
    // define variables
    const rankPct = pct(`need_rank_${model}`);
    const fundRank = pct("funding_rank");
    const hasFunding = +stats.funding_total > 0;
    const diff =
      rankPct !== null && fundRank !== null ? rankPct - fundRank : null;
    // tags
    let tagVariant = "neutral";
    let tagLabel = "DATA LIMITED";
    if (rankPct !== null) {
      tagVariant = rankPct >= 75 ? "info" : rankPct >= 50 ? "info" : "neutral";
      tagLabel =
        rankPct >= 75
          ? "HIGH NEED"
          : rankPct >= 50
            ? "ELEVATED NEED"
            : "LOWER NEED";
    }
    // html content
    let html = `<b>${town}</b>` + tags([tagVariant, tagLabel]);
    html += "Combines estimated flood risk and social vulnerability. ";
    html +=
      rankPct !== null
        ? `Ranks higher than ${rankPct}% of Vermont towns.`
        : "Combined need data unavailable.";
    if (diff !== null) {
      if (diff > 15)
        html += note(
          "Federal mitigation funding trails this town's measured flood need.",
        );
      else if (diff < -15 && hasFunding)
        html += note(
          "Funding levels exceed what measured need alone would predict.",
        );
    }
    html += modelNote();
    return html;
  }

  if (base === "funding") {
    // define variables
    const rankPct = pct("funding_rank");
    const needRank = pct(`need_rank_${model}`);
    const hasFunding = +stats.funding_total > 0;
    const fund = fmt$(stats.funding_total);
    const fpc = fmt$(stats.funding_per_capita);
    const tagItems = hasFunding
      ? [
          [
            rankPct >= 50 ? "success" : "neutral",
            rankPct >= 50 ? "HIGH FEMA INVESTMENT" : "LIMITED FUNDING",
          ],
        ]
      : [["warning", "NO FEMA FUNDING"]];
    // html content
    let html = `<b>${town}</b>` + tags(...tagItems);
    if (!hasFunding) {
      html += "No recorded FEMA mitigation funding.";
      if (needRank >= 50) {
        html += note("Despite comparatively high measured flood need.");
      }
    } else if (rankPct !== null) {
      html += `Received more mitigation funding than ${rankPct}% of Vermont towns.`;
      if (fund) html += note(`Total funding: ${fund} since 1990.`);
      if (fpc) html += note(`Equivalent to ${fpc} per resident.`);
    }
    return html;
  }

  if (base === "gap") {
    // define variables
    const gapRank = pct(`gap_rank_${model}`);
    const needRank = pct(`need_rank_${model}`);
    const fundRank = pct("funding_rank");
    const hasFunding = +stats.funding_total > 0;
    // tags
    const tagItems = [];
    if (!hasFunding) tagItems.push(["warning", "NO FEMA FUNDING"]);
    else if (gapRank >= 70) tagItems.push(["warning", "UNDERFUNDED"]);
    else if (gapRank <= 30) tagItems.push(["success", "FUNDING ALIGNED"]);
    else tagItems.push(["neutral", "ROUGHLY ALIGNED"]);
    if (needRank >= 75) tagItems.push(["info", "HIGH NEED"]);
    // html content
    let html =
      `<b>${town}</b>` + (tagItems.length ? tags(...tagItems) : "<br>");
    if (gapRank !== null) {
      if (!hasFunding) {
        html +=
          needRank >= 70
            ? "No recorded FEMA mitigation funding despite elevated flood risk."
            : "No recorded FEMA mitigation funding.";
      } else if (gapRank >= 70) {
        html += "Appears underfunded relative to measured flood need.";
        const diff =
          needRank !== null && fundRank !== null ? needRank - fundRank : null;
        if (diff !== null && diff > 10)
          html += note(
            `Funding trails measured need by ${diff} percentile points.`,
          );
      } else if (gapRank <= 30) {
        html += hasFunding
          ? "Has received more funding than its measured need would predict."
          : "Flood need is relatively limited compared to other Vermont towns.";
      } else {
        html += "Funding levels appear broadly aligned with measured need.";
      }
    }
    html += modelNote();
    return html;
  }

  if (base === "claims") {
    // define variables
    const rankPct = pct("claims_rank");
    const riskRank = pct(`risk_rank_${model}`);
    const diff =
      rankPct !== null && riskRank !== null ? rankPct - riskRank : null;
    // tags
    const tagItems = [];
    if (rankPct !== null && rankPct >= 50)
      tagItems.push(["danger", "FLOODING HISTORY"]);
    else tagItems.push(["neutral", "LIMITED CLAIMS"]);
    if (diff !== null && diff < -20)
      tagItems.push(["info", "REACTIVE PATTERN"]);
    // html content
    let html = `<b>${town}</b>` + tags(...tagItems);
    if (rankPct !== null && rankPct >= 50) {
      html += `Historical flood insurance claims rank higher than ${rankPct}% of Vermont towns.`;
      if (diff !== null && diff > 20)
        html += note(
          "Historical losses exceed what current modeled risk alone would suggest.",
        );
      html += note(
        "Reflects past insured losses, not necessarily future exposure.",
      );
    } else if (rankPct !== null) {
      html += `Relatively limited NFIP claims history.`;
      if (diff !== null && diff < -20)
        html += note(
          "Projected flood exposure appears higher than historical claims patterns.",
        );
      html += note("Past claims do not fully capture future flood exposure.");
    }
    return html;
  }

  // default fallback
  return `<b>${town}</b>`;
}

//////////////////////////////////////////////////////////

// quadrant hover & popups

// short one-line hover for quadrant layer
function buildQuadrantHover(town) {
  const stats = statsByTown[town];
  if (!stats) return `<b>${town}</b>`;
  const quadrant = stats[`quadrant_${metricEngine.model}`];
  const labels = {
    underfunded: "High flood need, limited mitigation funding.",
    aligned: "Funding broadly aligned with measured flood need.",
    overfunded: "Higher funding relative to measured need.",
    low_priority: "Lower flood need and limited mitigation funding.",
    zero_funding: "No recorded FEMA mitigation funding.",
  };
  return `<b>${town}</b><br>${labels[quadrant] ?? quadrantLabels[quadrant] ?? "No data"}`;
}

// expanded click popup for quadrant layer
function buildQuadrantPopup(town) {
  const stats = statsByTown[town];
  // safety check in case stats are missing for this town (shouldn't happen)
  if (!stats) return `<b>${town}</b>`;

  // define variables for quadrant assignment, risk rank, and helper functions to build HTML snippets
  const quadrant = stats[`quadrant_${metricEngine.model}`];
  const note = (text) => `<span class="popup-note">${text}</span>`;
  const tag = (variant, label) =>
    `<div class="popup-tags"><span class="popup-tag ${variant}">${label}</span></div>`;
  const riskRank = Math.round(
    (+stats[`risk_rank_${metricEngine.model}`] || 0) * 100,
  );

  // conditionals for each quadrant to build tailored popup content
  switch (quadrant) {
    case "underfunded":
      return (
        `<b>${town}</b>` +
        tag("warning", "UNDERFUNDED") +
        `High flood need, limited mitigation funding.<br>` +
        note(
          "One of Vermont's more exposed towns, but has received relatively little federal support.",
        ) +
        buildModelNote()
      );
    case "aligned":
      return (
        `<b>${town}</b>` +
        tag("success", "FUNDING ALIGNED") +
        `Funding levels are broadly aligned with measured flood need.` +
        note("Suggests federal investment has tracked exposure in this town.") +
        buildModelNote()
      );
    case "overfunded":
      return (
        `<b>${town}</b>` +
        tag("neutral", "HIGHER FUNDING") +
        `Has received comparatively high mitigation funding relative to measured need.` +
        note(
          "May reflect past disaster events or infrastructure investments not fully captured by the model.",
        ) +
        buildModelNote()
      );
    case "low_priority":
      return (
        `<b>${town}</b>` +
        tag("neutral", "LOW NEED") +
        `Lower measured flood need and relatively limited mitigation funding.` +
        note(
          "Lower exposure reduces the urgency for federal mitigation investment.",
        ) +
        buildModelNote()
      );
    case "zero_funding": {
      let html =
        `<b>${town}</b>` +
        tag("warning", "NO FEMA FUNDING") +
        `No recorded FEMA mitigation funding.`;
      if (riskRank >= 50)
        html += note(
          `Despite flood risk ranking higher than ${riskRank}% of Vermont towns.`,
        );
      html += buildModelNote();
      return html;
    }
    default:
      return `<b>${town}</b><br>${quadrantLabels[quadrant] ?? "No data"}`;
  }
}
