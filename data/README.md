# Data

This directory contains the raw datasets, intermediate cleaned datasets, and supporting resources used to build the Floodlines project.

```
data/
├── raw/          # Original source datasets
├── cleaned/      # Intermediate and final processed datasets
└── resources/    # Reference files used during processing
```

---

## Directory Structure

### `raw/`

Original datasets downloaded from external sources. These files are preserved as closely as possible to their published form and serve as the starting point for the ETL pipeline.

| Folder | Source | Purpose |
|---------|--------|---------|
| `acs/` | U.S. Census Bureau | Demographic and housing characteristics |
| `census_shp/` | U.S. Census Bureau | Vermont town boundary shapefiles |
| `FEMA_NFHL/` | FEMA | National Flood Hazard Layer |
| `FEMA_NRI/` | FEMA | National Risk Index |
| `funding/` | FEMA OpenFEMA | Hazard Mitigation Assistance projects |
| `NFIP/` | FEMA OpenFEMA | Flood insurance claims and policy data |
| `VT_river_corridors/` | Vermont ANR | State river corridor polygons |
| `VT_shp/` | Vermont Center for Geographic Information | Vermont reference boundaries |

**Note:** Some large source datasets are excluded from Git using `.gitignore` because of their size, including the River Corridor dataset and portions of the FEMA National Risk Index.

---

### `cleaned/`

Outputs produced by the ETL notebooks.

| File | Produced by | Purpose |
|------|-------------|---------|
| `town_flood_risk.csv` | 01 | Town-level flood exposure metrics |
| `acs_summary.csv` | 02 | Consolidated ACS demographic indicators |
| `fema_hma_town_level.csv` | 03 | Town-level mitigation funding |
| `fema_hma_non_town_level.csv` | 03 | Regional and statewide FEMA projects |
| `nfip_summary.csv` | 04 | Town-level insurance claims and policies |
| `fema_nri_town_level.csv` | 05 | Area-weighted National Risk Index metrics |
| `town_level_merged_for_eda.csv` | 09 | Master analytical dataset |
| `census.geojson` | 01 | Web-ready Vermont town boundaries |
| `nfhl.geojson` | 01 | Processed FEMA flood hazard polygons |
| `river_corridors.geojson` | 01 | Processed river corridor polygons |
| `nri_tracts.geojson` | 05 | Processed NRI tract geometries |

The `acs/` subdirectory contains intermediate cleaned Census tables before they are merged into `acs_summary.csv`.

---

### `resources/`

Supporting reference datasets used during ETL.

| File | Purpose |
|------|---------|
| `CPIAUCSL.csv` | Inflation adjustment (2025 dollars) |
| `FEMA_project_codes.csv` | FEMA project type classification |
| `zip_code_database.csv` | ZIP code reference used during town assignment and data cleaning |

---

## Data Flow

```
raw/
    │
    ▼
ETL notebooks (01–09)
    │
    ▼
cleaned/
    │
    ▼
EDA notebooks (10–13)
    │
    ▼
Analysis notebooks (20–22)
    │
    ▼
29_export_to_web.ipynb
    │
    ▼
docs/static/resources/
```

---

## Additional Documentation

Variable definitions, derived metrics, and methodology are documented in the repo root:

- `data_dictionary_backend.md` — Full variable reference for the analytical pipeline: raw inputs, derived metrics, index construction, and model specifications.
- `data_dictionary_frontend.md` — Variable reference for the web export layer: the fields present in `town_stats.csv` and `town_boundaries.geojson` as consumed by the dashboard.

Those documents serve as the project's authoritative reference for all analytical variables used throughout the notebooks and dashboard.