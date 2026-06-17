// Description: Centralised label ↔ key mappings for overlays and models.
// Edit here when adding metrics or renaming UI labels — no other files need to change.

// overlay label (data-overlay attribute) → base metric key
const overlayToBase = {
  "Flood Risk": "risk",
  Vulnerability: "vulnerability",
  "Combined Need": "need",
  "Mitigation Funding": "funding",
  "Funding Gap": "gap",
  "NFIP Claims": "claims",
};

// base metric key → display label (derived — do not edit directly)
const baseToOverlay = Object.fromEntries(
  Object.entries(overlayToBase).map(([label, key]) => [key, label]),
);

// overlay defintion mapping (for metric definition HTML)
const overlayDefMap = {
  "Flood Risk": "def-risk",
  Vulnerability: "def-vulnerability",
  "Combined Need": "def-need",
  "Mitigation Funding": "def-funding",
  "Funding Gap": "def-gap",
  "NFIP Claims": "def-claims",
  Quadrants: "def-quadrants",
  Population: "def-population",
  "Funding Bubble": "def-funding-bubble",
  "River Corridors": "def-river-corridors",
};

// model label (data-overlay attribute on model selector) → model key
const modelLabels = {
  "Total Risk": "eal",
  "Risk per Person": "eal_per_capita",
  "FEMA Risk Index": "nri",
};

// model key → display label (derived — do not edit directly)
const modelKeyToLabel = Object.fromEntries(
  Object.entries(modelLabels).map(([label, key]) => [key, label]),
);

// model definition mapping (for model definition HTML)
const modelDefMap = {
  eal: "model-def-eal",
  eal_per_capita: "model-def-eal-per-capita",
  nri: "model-def-nri",
};

// base metric keys that are incompatible with the NRI model (NRI score already embeds SOVI)
// add entries here when new metrics become NRI-incompatible — updateNRIModelUI derives button selectors automatically
const nriBlockedMetrics = ["risk", "vulnerability"];

// human-readable quadrant labels (keys match quadrantColors)
const quadrantLabels = {
  zero_funding: "No recorded investment", // No Funding
  underfunded: "Underserved",
  aligned: "Funding roughly aligned",
  overfunded: "Historically invested", // Over-allocated
  low_priority: "Low priority", // Low Exposure
};

// narrative headlines for the stats card header (longer than quadrantLabels — not used in map/plot)
const quadrantHeadlines = {
  zero_funding: "No recorded FEMA mitigation funding",
  underfunded: "High flood need, limited mitigation funding",
  aligned: "Funding broadly aligned with measured need",
  overfunded: "Prior disaster history reflected in funding record",
  low_priority: "Lower flood need and lower funding priority",
};

// one-sentence interpretive sublines for the stats card
const quadrantSummaries = {
  zero_funding:
    "Measurable flood exposure present, but no FEMA mitigation investment appears in the funding record.",
  underfunded: "Modeled flood need outpaces current mitigation investment.",
  aligned:
    "Mitigation investment reflects modeled flood exposure and community vulnerability.",
  overfunded:
    "Investment levels often reflect past disaster recovery — a pattern of the system responding to prior loss rather than current modeled risk.",
  low_priority:
    "Lower modeled risk and vulnerability relative to other Vermont municipalities.",
};

// default map view for Vermont
const vtDefaultView = { center: [43.75, -72.7], zoom: 8 };
// const vtDefaultView = { center: [43.9, -72.7], zoom: 8.5 };
