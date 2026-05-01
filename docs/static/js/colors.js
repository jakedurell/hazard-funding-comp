// set default color scheme
const defaultColors = {
  defaultGray: "#343a40", // #6c757d
  townColor: "#ff9800",
};

// choropleth colors
const choroplethConfig = {
  gap_eal: {
    // scale: d3.scaleSequential(d3.interpolateBlues).domain([0, 1]),
    scale: d3.scaleDiverging(d3.interpolateRdBu).domain([-1, 0, 1]),
    label: "Gap (Funding vs Need)",
  },
  gap_eal_std: {
    scale: d3.scaleDiverging(d3.interpolatePuOr).domain([-2, 0, 2]),
    label: "Gap (Funding vs Need) vs VT Avg",
  },
  funding_total: {
    scale: d3.scaleSequential(d3.interpolatePurples).domain([0, 3e6]),
    label: "Funding",
  },
  funding_scaled_vs_state_mean: {
    scale: d3.scaleDiverging(d3.interpolatePRGn).domain([0, 1, 1.5]),
    label: "Funding vs VT Avg",
  },
  need_eal: {
    scale: d3.scaleSequential(d3.interpolateGnBu).domain([0, 1]),
    label: "Need Index",
  },
  need_eal_vs_state_mean: {
    scale: d3.scaleDiverging(d3.interpolateBrBG).domain([0, 1, 2]),
    label: "Need Index vs VT Avg",
  },
  risk_eal: {
    scale: d3.scaleSequential(d3.interpolateOranges).domain([0, 1]),
    label: "Risk",
  },
  risk_eal_vs_state_mean: {
    scale: d3.scaleDiverging(d3.interpolateOrRd).domain([0, 1, 2]),
    label: "Risk vs VT Avg",
  },
  vulnerability_index: {
    scale: d3.scaleSequential(d3.interpolateGreens).domain([0, 1]),
    label: "Vulnerability",
  },
  vulnerability_index_vs_state_mean: {
    scale: d3.scaleDiverging(d3.interpolatePiYG).domain([0, 1, 2]),
    label: "Vulnerability vs VT Avg",
  },
  // total_listings: {
  //   scale: d3.scaleSequential(d3.interpolateReds).domain([0, 700]),
  //   label: "Total Listings",
  // },
  // total_listings_vs_state_mean: {
  //   scale: d3.scaleDiverging(d3.interpolateRdBu).domain([-200, 0, 200]),
  //   label: "Total Listings vs VT Avg",
  // },
};
