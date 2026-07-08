# JavaScript Architecture

This directory contains the client-side code for the Floodlines dashboard and article.

```
static/js/
├── config.js                  # Global configuration and constants
├── colors.js                  # Color palettes and styling helpers
│
├── rankings.js                # Rankings table
├── plots.js                   # D3 scatterplot visualization
├── statsCard.js               # Summary statistic card
│
├── mapCore.js                 # Creates and initializes the Leaflet map
├── mapLayers.js               # Base layers and choropleth layers
├── mapOverlays.js             # Overlay creation and management
├── mapControls.js             # Custom Leaflet controls
├── mapLegend.js               # Dynamic map legend
├── mapChoroplethPopups.js     # Hover labels and popup behavior
│
├── app.js                     # Application entry point
│
├── hamburger.js               # Mobile navigation
├── tour.js                    # Guided application tour
|
└── articleController.js       # Article page interactivity
```

## Module Overview

### Configuration

- **config.js** – Shared configuration values, file paths, default settings, and application constants.
- **colors.js** – Centralized color palettes used throughout the dashboard.

### Dashboard Components

These modules generate the non-map interface.

- **rankings.js** – Builds and updates the town rankings table.
- **plots.js** – Creates D3 scatterplot visualization.
- **statsCard.js** – Generates summary statistics card.

### Map System

- **mapCore.js** – Initializes the Leaflet map and coordinates the mapping system.
- **mapLayers.js** – Creates base layers and choropleth layers.
- **mapOverlays.js** – Manages overlay layers and related behavior.
- **mapControls.js** – Adds custom controls and user interface elements.
- **mapLegend.js** – Builds and updates the dynamic legend.
- **mapChoroplethPopups.js** – Generates hover labels and popup content for town polygons.

### Application Bootstrap

- **app.js** loads project datasets, prepares shared lookup objects, and initializes the dashboard.

### Utilities

- **hamburger.js** – Responsive navigation menu.
- **tour.js** – Interactive guided tour using Shepherd.js.

---

## Initialization Flow

```
app.js
    │
    ├── Load GeoJSON and CSV datasets
    ├── Build shared lookup objects
    ├── Initialize Leaflet map
    │      │
    │      ├── mapCore.js
    │      ├── mapLayers.js
    │      ├── mapControls.js
    │      ├── mapLegend.js
    │      ├── mapOverlays.js
    │      └── mapChoroplethPopups.js
    │
    ├── Initialize dashboard components
    │      ├── rankings.js
    │      ├── plots.js
    │      └── statsCard.js
    │
    └── Dashboard ready
```

## Article System

The interactive article reuses many of the dashboard's visualization components while providing its own narrative interface.

- **articleController.js** – Coordinates article-specific interactivity, including:
  - synchronizing the active vulnerability model across figures
  - updating shared D3 visualization
  - crossfading model-specific images
  - persisting model selection in local storage
  - managing sticky model-selection controls
  - bootstrapping reusable dashboard components within the article

Unlike the dashboard modules, `articleController.js` is article-page-only and primarily serves as integration ("glue") code that connects reusable visualization components to the article's narrative interface.

## Known Architectural Notes

Overlay and popup management was added incrementally during development. A candidate refactor consolidating overlay state into an object-oriented architecture is sketched in `archive/overlay-manager-refactor.js`; the current implementation is functional but has some duplication across `mapOverlays.js` and `mapChoroplethPopups.js`.