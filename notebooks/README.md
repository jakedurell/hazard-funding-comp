# Notebooks

This directory contains the complete analytical pipeline for the **Floodlines** project, from raw data exploration through ETL, exploratory analysis, model development, validation, and export for the interactive web dashboard.

The notebooks are intended to be run approximately in numerical order, though several exploratory notebooks are independent once the merged dataset has been produced.

---

## Workflow Overview

```
Initial Exploration
        │
        ▼
ETL
        │
        ▼
Merged Dataset
        │
        ▼
Exploratory Data Analysis
        │
        ▼
Need Index Development
        │
        ▼
Sensitivity & Validation
        │
        ▼
Web Export
        │
        ▼
Interactive Dashboard
```

---

# Notebook Guide

## 00 — Initial Exploration

| Notebook | Purpose |
|----------|---------|
| `00_initial_data_exploration.ipynb` | Assessed source datasets, spatial coverage, GEOID consistency, and overall project feasibility before beginning ETL. |

---

## ETL

| Notebook | Purpose |
|----------|---------|
| `01_etl_gis.ipynb` | Processes Vermont boundaries, river corridors, and FEMA flood hazard layers into town-level exposure metrics. |
| `02_etl_acs.ipynb` | Cleans ACS demographic variables and computes socioeconomic indicators. |
| `03_etl_fema_hma_finance.ipynb` | Cleans FEMA Hazard Mitigation Assistance awards and assigns projects to Vermont towns. |
| `04_etl_nfip_insurance.ipynb` | Cleans NFIP claims and policy data and aggregates them to the town level. |
| `05_etl_fema_nri.ipynb` | Converts FEMA National Risk Index tract data into town-level statistics using area-weighted spatial interpolation. |
| `06_etl_river_corridors.ipynb` | Produces optimized river corridor GeoJSON layers for web mapping. |
| `09_etl_final_merge.ipynb` | Validates and merges all cleaned datasets into the master analytical dataset. |

---

## Exploratory Data Analysis

| Notebook | Purpose |
|----------|---------|
| `10_eda_overview.ipynb` | Correlation analysis and high-level statistical overview. |
| `11_eda_choropleths.ipynb` | Choropleth maps for key variables. |
| `12_eda_outliers.ipynb` | Identification and interpretation of unusual funding and risk patterns. |
| `13_eda_hma_nfip.ipynb` | Exploratory visualizations of mitigation funding and insurance activity. |

---

## Modeling & Analysis

| Notebook | Purpose |
|----------|---------|
| `20_analysis_build_index.ipynb` | Develops the flood mitigation need and funding gap indices and evaluates candidate models. |
| `21_sensitivity_checks.ipynb` | Tests robustness to weighting, normalization, and variable selection. |
| `22_quadrant_and_exclusion_analysis.ipynb` | Compares competing model specifications and funding classifications. |

---

## Export

| Notebook | Purpose |
|----------|---------|
| `29_export_to_web.ipynb` | Generates the final CSV and GeoJSON consumed by the interactive dashboard. |
| `30_article_image_export.ipynb` | Exports publication-quality figures for the accompanying article and project documentation. |

---

# Pipeline Summary

The project follows a reproducible analytical workflow:

1. Evaluate raw datasets
2. Clean and standardize each data source
3. Merge into a unified town-level dataset
4. Explore distributions and relationships
5. Develop and validate flood mitigation need indices
6. Compare alternative model specifications
7. Export web-ready datasets and visual assets

This structure separates data engineering, exploratory analysis, statistical modeling, and deployment into independent stages, making the project easier to reproduce, audit, and extend.

---

## Known Architectural Notes

An alternative data backend was sketched but never implemented. `archive/scripts/` contains:

- `sql/schema.sql` – A relational schema for the analytical dataset
- `etl/` – Python scripts to load cleaned data into the SQL database
- `export/` – Python scripts to query and export data from the database for web consumption

This approach would have replaced the notebook-based CSV pipeline with a more structured data layer. It was set aside in favor of keeping the pipeline self-contained in Jupyter notebooks, which are easier to inspect and reproduce without a database dependency. The scripts are preserved as a reference if the project is extended or ported to a production environment.