// Description: Centralised label ↔ key mappings for overlays and models.
// Edit here when adding metrics or renaming UI labels — no other files need to change.

// overlay label (data-overlay attribute) → base metric key
const overlayToBase = {
  Risk: "risk",
  "Social Vulnerability": "vulnerability",
  "Need Index": "need",
  Funding: "funding",
  "Gap (Funding vs Need)": "gap",
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

// default map view for Vermont
const vtDefaultView = { center: [43.75, -72.7], zoom: 8 };
