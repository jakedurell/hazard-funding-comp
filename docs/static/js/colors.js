// set default color scheme
const defaultColors = {
  defaultGray: "#6c757d", // #343a40
  townColor: "#ff9800",
  // riverColor: "#1f78b4",
  riverColor: "#2e86c1",
};

// quadrant colors (categorical)
const quadrantColors = {
  zero_funding: "#888888",
  underfunded: "#e41a1c",
  aligned: "#377eb8",
  overfunded: "#4daf4a",
  low_priority: "#ff7f00",
};

// choropleth colors
const choroplethConfig = {
  gap_rank: {
    // scale: d3.scaleSequential(d3.interpolateRdBu).domain([0, 1]),
    scale: d3
      .scaleDiverging((t) => d3.interpolateYlOrRd(1 - t))
      .domain([-1, 0, 1]),
    label: "Funding Gap",
  },
  gap_rel: {
    scale: d3.scaleDiverging(d3.interpolateRdYlBu).domain([-1, 0, 1]),
    label: "Funding Gap vs VT Avg",
  },
  funding_rank: {
    scale: d3.scaleSequential(d3.interpolateBlues).domain([0, 1]),
    label: "Mitigation Funding",
  },
  funding_rel: {
    scale: d3.scaleDiverging(d3.interpolateRdYlBu).domain([-1, 0, 1]),
    label: "Funding vs VT Avg",
  },
  need_rank: {
    scale: d3.scaleSequential(d3.interpolateGnBu).domain([0, 1]),
    label: "Combined Need",
  },
  need_rel: {
    scale: d3
      .scaleDiverging((t) => d3.interpolateRdYlBu(1 - t))
      .domain([-1, 0, 1]),
    label: "Need vs VT Avg",
  },
  risk_rank: {
    scale: d3.scaleSequential(d3.interpolateReds).domain([0, 1]),
    label: "Flood Risk",
  },
  risk_rel: {
    scale: d3
      .scaleDiverging((t) => d3.interpolateRdYlBu(1 - t))
      .domain([-1, 0, 1]),
    label: "Risk vs VT Avg",
  },
  vulnerability_rank: {
    scale: d3
      .scaleSequential((t) => d3.interpolateOranges(1 - t))
      .domain([0, 1]),
    label: "Vulnerability",
  },
  vulnerability_rel: {
    scale: d3
      .scaleDiverging((t) => d3.interpolateRdYlBu(1 - t))
      .domain([-1, 0, 1]),
    label: "Vulnerability vs VT Avg",
  },
};

// semantic left/right labels for choropleth legend gradient bar
const legendLabels = {
  gap_rank: { low: "Funded below need", high: "Funded above need" },
  gap_rel: { low: "Further below average", high: "Further above average" },
  funding_rank: { low: "Less funding", high: "More funding" },
  funding_rel: { low: "Below VT average", high: "Above VT average" },
  need_rank: { low: "Lower need", high: "Higher need" },
  need_rel: { low: "Below VT average", high: "Above VT average" },
  risk_rank: { low: "Lower risk", high: "Higher risk" },
  risk_rel: { low: "Below VT average", high: "Above VT average" },
  vulnerability_rank: { low: "Less vulnerable", high: "More vulnerable" },
  vulnerability_rel: { low: "Below VT average", high: "Above VT average" },
};
