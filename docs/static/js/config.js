// Description: Centralised label ↔ key mappings for overlays and models.
// Edit here when adding metrics or renaming UI labels — no other files need to change.

// overlay label (data-overlay attribute) → base metric key
const overlayToBase = {
  "Flood Risk": "risk",
  Vulnerability: "vulnerability",
  "Combined Need": "need",
  "Mitigation Funding": "funding",
  "Funding Gap": "gap",
};

// base metric key → display label (derived — do not edit directly)
const baseToOverlay = Object.fromEntries(
  Object.entries(overlayToBase).map(([label, key]) => [key, label]),
);

// model label (data-overlay attribute on model selector) → model key
const modelLabels = {
  EAL: "eal",
  "EAL per capita": "eal_per_capita",
  NRI: "nri",
};

// human-readable quadrant labels (keys match quadrantColors)
const quadrantLabels = {
  zero_funding: "No FEMA Funding", // No Funding
  underfunded: "High Need / Low Funding",
  aligned: "Funding Roughly Aligned",
  overfunded: "Lower Need / Higher Funding", // Over-allocated
  low_priority: "Lower Need / Lower Funding", // Low Exposure
};

// default map view for Vermont
const vtDefaultView = { center: [43.75, -72.7], zoom: 8 };
