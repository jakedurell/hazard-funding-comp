// ==========================================================
// Color Configuration
//
// Defines the project's shared color palettes and D3 color
// scales used throughout the dashboard and interactive map.
//
// Responsibilities:
// • Shared UI colors
// • Quadrant color palette
// • Choropleth color scales
// • Legend labels
// ==========================================================

// set default color scheme
const defaultColors = {
  defaultGray: "#6c757d", // #343a40
  populationColor: "#ff9800",
  fundingColor: "#2166ac",
  // riverColor: "#1f78b4",
  riverColor: "#2e86c1",
};

// quadrant colors (categorical)
const quadrantColors = {
  zero_funding: "#888888", // gray for absent/unknown feels right
  underfunded: "#d55e00", // vermilion — warm alarm, not pure red, CVD-distinguishable
  aligned: "#0072b2", // deep blue — matches dashboard primary theme (#0085a1)
  overfunded: "#cc79a7", // mauve/pink — distinct from vermilion under CVD
  low_priority: "#e69f00", // amber — warm but lower urgency than vermilion
};
// const quadrantColors = {
//   zero_funding: "#7f7f7f",   // neutral gray
//   underfunded: "#d73027",   // red
//   aligned: "#4575b4",       // blue
//   overfunded: "#1b9e77",    // teal-green
//   low_priority: "#e6ab02",  // mustard/gold
// };
// const quadrantColors = {
//   underfunded: "#b2182b", // dark red
//   aligned: "#4d4d4d", // neutral dark gray
//   overfunded: "#2166ac", // blue
//   low_priority: "#fdae61", // orange
//   zero_funding: "#bdbdbd", // light gray
// };

// choropleth colors
const choroplethConfig = {
  gap_rank: {
    // gap = need - funding: rank 1.0 = most underfunded = dark red
    scale: d3.scaleSequential(d3.interpolateYlOrRd).domain([0, 1]),
    label: "Funding Gap",
  },
  gap_rel: {
    // positive gap_rel = underfunded = red; negative = overfunded = blue
    scale: d3
      .scaleDiverging((t) => d3.interpolateRdYlBu(1 - t))
      .domain([-1, 0, 1]),
    label: "Funding Gap vs. VT Average",
  },
  funding_rank: {
    scale: d3.scaleSequential(d3.interpolateBlues).domain([0, 1]),
    label: "Mitigation Funding",
  },
  funding_rel: {
    scale: d3
      .scaleDiverging((t) => d3.interpolateRdYlBu(1 - t))
      .domain([-1, 0, 1]),
    label: "Funding vs VT Avg",
  },
  need_rank: {
    scale: d3.scaleSequential(d3.interpolateYlOrBr).domain([0, 1]),
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
    scale: d3.scaleSequential(d3.interpolateOranges).domain([0, 1]),
    label: "Social Vulnerability",
  },
  vulnerability_rel: {
    scale: d3
      .scaleDiverging((t) => d3.interpolateRdYlBu(1 - t))
      .domain([-1, 0, 1]),
    label: "Vulnerability vs. VT Average",
  },
  claims_rank: {
    scale: d3.scaleSequential(d3.interpolatePurples).domain([0, 1]),
    label: "NFIP Claims per Capita",
  },
  claims_rel: {
    scale: d3
      .scaleDiverging((t) => d3.interpolateRdYlBu(1 - t))
      .domain([-1, 0, 1]),
    label: "NFIP Claims vs. VT Average",
  },
};

// semantic left/right labels for choropleth legend gradient bar
const legendLabels = {
  gap_rank: { low: "Smaller funding gap", high: "Larger funding gap" },
  gap_rel: { low: "Gap below VT average", high: "Gap above VT average" },
  funding_rank: { low: "Less funding", high: "More funding" },
  funding_rel: { low: "Below VT average", high: "Above VT average" },
  need_rank: { low: "Lower need", high: "Higher need" },
  need_rel: { low: "Below VT average", high: "Above VT average" },
  risk_rank: { low: "Lower risk", high: "Higher risk" },
  risk_rel: { low: "Below VT average", high: "Above VT average" },
  vulnerability_rank: { low: "Less vulnerable", high: "More vulnerable" },
  vulnerability_rel: { low: "Below VT average", high: "Above VT average" },
  claims_rank: { low: "Fewer claims", high: "More claims" },
  claims_rel: { low: "Below VT average", high: "Above VT average" },
};
