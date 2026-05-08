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
    scale: d3.scaleSequential(d3.interpolateBlues).domain([0, 1]),
    label: "Gap (Funding vs Need)",
  },
  gap_rel: {
    scale: d3.scaleDiverging(d3.interpolatePuOr).domain([-1, 0, 1]),
    label: "Gap (Funding vs Need) vs VT Avg",
  },
  funding_rank: {
    scale: d3.scaleSequential(d3.interpolatePurples).domain([0, 1]),
    label: "Funding",
  },
  funding_rel: {
    scale: d3.scaleDiverging(d3.interpolatePRGn).domain([-1, 0, 1]),
    label: "Funding vs VT Avg",
  },
  need_rank: {
    scale: d3.scaleSequential(d3.interpolateGnBu).domain([0, 1]),
    label: "Need Index",
  },
  need_rel: {
    scale: d3.scaleDiverging(d3.interpolateBrBG).domain([-1, 0, 1]),
    label: "Need Index vs VT Avg",
  },
  risk_rank: {
    scale: d3.scaleSequential(d3.interpolateOranges).domain([0, 1]),
    label: "Risk",
  },
  risk_rel: {
    scale: d3.scaleDiverging(d3.interpolateOrRd).domain([-1, 0, 1]),
    label: "Risk vs VT Avg",
  },
  vulnerability_rank: {
    scale: d3.scaleSequential(d3.interpolateGreens).domain([0, 1]),
    label: "Vulnerability",
  },
  vulnerability_rel: {
    scale: d3.scaleDiverging(d3.interpolatePiYG).domain([-1, 0, 1]),
    label: "Vulnerability vs VT Avg",
  },
  // total_listings: {
  //   scale: d3.scaleSequential(d3.interpolateReds).domain([0, 700]),
  //   label: "Total Listings",
  // },
  // total_listings_rel: {
  //   scale: d3.scaleDiverging(d3.interpolateRdBu).domain([-1, 0, 1]),
  //   label: "Total Listings vs VT Avg",
  // },
};
