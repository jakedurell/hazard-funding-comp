# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

This is a working copy of **Floodlines** by Bryan C. Johns (MIT licensed, © 2026) — an index-based analysis of whether FEMA Hazard Mitigation Assistance (HMA) funding tracks flood risk and social vulnerability across Vermont's 250+ towns.

It is being repurposed for a different question: whether **North Topsail Beach, NC** helps its homeowners pursue hazard mitigation funds compared to similarly situated NC coastal municipalities. The output is eventually destined for the Reef Advocate repo.

**Current state: everything in this repo is still the Vermont analysis.** All data, notebooks, and the dashboard describe Vermont. No North Carolina data has been ingested. Do not describe Vermont results as North Carolina results, and do not assume a file has been ported just because its name is generic.

Attribution constraints: keep the `LICENSE` copyright notice intact, keep the standardized file headers Bryan Johns added at the top of each JS module and script, and preserve upstream credit in `README.md` when editing it.

## The NC module (`docs/nc/`, `scripts/build_nc_data.py`)

This is the new work, independent of the inherited Vermont pipeline. It does not use the notebooks, the `data/cleaned/` outputs, or any of `docs/static/js/`.

```
scripts/build_nc_data.py          stdlib-only builder: fetch → name-match → emit
  ├─ FEMA HMA bulk CSV            fema.gov/api/open/v4/HazardMitigationAssistanceProjects.csv
  └─ Census TIGERweb              incorporated-place polygons as GeoJSON, no API key
       ↓
docs/nc/data/nc_hma.json          single payload: meta + projects[] + boundaries
docs/nc/data/unmatched.csv        audit: coastal-county subrecipients that did NOT match
       ↓
docs/nc/index.html                self-contained Leaflet dashboard (no build, no modules)
```

Run `python3 scripts/build_nc_data.py` (add `--refresh` to re-download; sources cache to `data/raw/NC/`, gitignored).

Three things matter when editing this:

- **`TOWNS` in the builder is the comparison frame.** 21 NC Atlantic-facing barrier-island municipalities, mapped to island groups. Changing the comp set means editing that dict, nothing else.
- **Name matching is the fragile part.** HMA's `subrecipient` is free text — "NORTH TOPSAIL BEACH", "North Topsail Beach", and "Town of North Topsail Beach" are three strings for one town, and NC has 505 distinct spellings. `normalize()` strips case, punctuation, parentheticals, and TOWN/CITY/OF/THE. **Always check `unmatched.csv` after a run** — a comp town silently dropping to zero because of a spelling variant is the failure mode that would most damage the analysis.
- **Category assignment drives the headline metric.** `is_homeowner_directed()` treats FEMA activity codes 200/202/203/207 (acquisition, elevation, reconstruction of private structures) as homeowner-directed; everything else is municipal asset, planning, or admin. The dashboard's central claim rests on this split, so changes here are substantive, not cosmetic.

Frontend conventions: colors come from the `dataviz` skill's validated reference palette, declared as CSS custom properties under `:root` plus both dark scopes (`prefers-color-scheme` and `[data-theme]`). Categorical hues are assigned per entity in fixed order and never cycled; the choropleth uses the single-hue blue sequential ramp. View state (selected towns, year range, metric) round-trips through the URL query string, so any view is shareable.

## Commands

There is no test suite, linter, or build step. The dashboard is plain static files.

```bash
# NC comparison module (the active work)
npm install            # one time
npm run build          # scripts/build_nc_data.py — add :refresh to re-download sources
npm start              # serve docs/ on :8000 → /nc/ is the NC map, / is the VT dashboard

# Analysis pipeline (inherited Vermont) — run notebooks in numeric order
jupyter lab

# Python deps (no requirements.txt; geospatial stack)
pip install pandas geopandas numpy matplotlib seaborn scikit-learn scipy statsmodels esda libpysal jupyterlab

# Serve the dashboard locally — must be over HTTP, app.js fetches CSV/GeoJSON
python -m http.server 8000 --directory docs    # then open http://localhost:8000

# Regenerate static map images for the article/README (requires npm install first)
node scripts/export_maps.js
node scripts/export_maps.js --center=43.9,-72.7 --zoom=8.5 --models=eal,eal_per_capita --bases=need,gap,quadrant

# CSS is compiled from SCSS (styles.css.map is committed; sass is not in package.json)
sass docs/static/css/styles.scss docs/static/css/styles.css
```

Deployment is GitHub Pages served from `docs/`. Editing files under `docs/` is editing the live site.

## Architecture

Two loosely coupled halves joined by exactly two exported files.

**1. Notebook ETL/analysis pipeline** (`notebooks/`, numbered by stage)

```
data/raw/ → 01–06 (per-source ETL) → data/cleaned/*.csv,*.geojson
          → 09_etl_final_merge → data/cleaned/town_level_merged_for_eda.csv   ← master analytical dataset
          → 10–13 (EDA) → 20 (index construction) → 21 (sensitivity) → 22 (quadrants)
          → 29_export_to_web → docs/static/resources/{town_stats.csv, town_boundaries.geojson}
```

Everything joins on **GEOID**, a 10-digit Census county-subdivision FIPS code (state 50 + county + subdivision). `29_export_to_web.ipynb` is the only bridge to the frontend; if the dashboard shows stale or missing values, that notebook is where to look.

**2. Static dashboard** (`docs/`) — `index.html` (dashboard), `article.html` (narrative), `appendix.html` (methodology), `map_export_template.html` (headless render target for `scripts/export_maps.js`).

No bundler, no ES modules. Every file in `docs/static/js/` declares globals and is loaded by `<script>` tags in a **load-order-dependent** sequence in each HTML page; `app.js` loads last and bootstraps. If you add a JS file you must add it to the `<script>` list in `index.html`, `article.html`, and `map_export_template.html` as appropriate. See `docs/static/js/README.md` for the module map and init flow.

`config.js` is the intended single edit point for UI labels, overlay↔metric mappings, model↔data-key mappings, quadrant labels/narratives, and the default map view. Prefer changing it over touching the map/plot modules.

### Metric naming convention

Exported columns follow `{metric}_{model}` — e.g. `risk_eal`, `need_eal_per_capita`, `gap_nri`, plus `_rank` and `_rel` (relative-to-state-average) variants. Metrics are `risk`, `vulnerability`, `need`, `funding`, `gap`, `claims`. Models are `eal`, `eal_per_capita`, `nri`.

Adding or renaming a model touches, at minimum: the model spec in `20_analysis_build_index.ipynb`, the export column list in `29_export_to_web.ipynb`, `modelLabels`/`modelDefMap`/`nriBlockedMetrics` in `config.js`, and the corresponding definition `<div>`s in the HTML. The `nri` model deliberately blocks the `risk` and `vulnerability` overlays because the NRI composite already embeds social vulnerability.

### Reference docs

Read these before changing analysis logic — they are the authoritative variable references:

- `data_dictionary_backend.md` — every raw, cleaned, and derived variable in the pipeline
- `data_dictionary_frontend.md` — every column in `town_stats.csv` / `town_boundaries.geojson`
- `technical_summary.md` — index construction, normalization choice, sensitivity results, limitations
- `notebooks/README.md`, `data/README.md`, `docs/static/js/README.md` — per-directory guides

`archive/` holds two unimplemented designs: a Postgres/PostGIS backend that would replace the notebook/CSV pipeline, and an object-oriented overlay-manager refactor. Neither is wired up; treat them as reference only.

## Porting from Vermont to North Carolina

The genuinely Vermont-specific parts, in the order they will bite:

- **Unit of analysis.** Vermont towns are Census *county subdivisions* (COUSUB, 10-digit GEOID) and are real governments. In North Carolina, county subdivisions are non-governmental townships — the municipality that actually applies for HMA funding is a Census *incorporated place* (PLACE, 7-digit GEOID). This decision propagates through every join, the ACS pulls, the NRI area-weighting, and the boundary GeoJSON. Settle it before writing any ETL.
- **River corridors** (`06_etl_river_corridors.ipynb`, both `river_corridors_tier*.geojson`, the `pct_river_corridor` variable, and the river-corridor overlay) come from the Vermont ANR and have no NC analog. For a barrier-island comparison the natural substitutes are NFHL zones (VE/AE), CBRS unit boundaries, and shoreline/erosion data.
- **Hardcoded VT sources**: `tl_2025_50_*` Census shapefiles, `nri_vt.csv`, `data/raw/VT_shp/`, state FIPS `50`.
- **Frontend copy**: `vtDefaultView` in `config.js` (also consumed by `mapCore.js` and `mapOverlays.js`), the "VT Avg" legend labels in `colors.js`, and the "…than X% of Vermont towns" popup strings in `mapChoroplethPopups.js`.

Nationally sourced and portable as-is: FEMA HMA, NFIP claims/policies, FEMA NRI, NFHL, ACS, FRED CPI.

## Analytical caveat that shapes this project's claim

The HMA dataset records **approved projects only** — not applications filed, not applications denied, not assistance a town declined to provide. A low or zero funding record is consistent with a town that never helped homeowners apply, and equally consistent with one that applied and lost, or whose homeowners never asked. The upstream project states this limitation plainly, and the reframed question ("does this town help its homeowners?") leans on it harder than the original did.

Quantitative gap analysis can establish that North Topsail Beach's funding record differs from its peers'. Establishing *why* requires evidence this pipeline does not contain — FEMA/NCEM application and sub-applicant records, town council minutes and budgets, staffing for grant administration, participation in NFIP CRS. Flag this distinction rather than papering over it in generated text or charts.

Note also that much of North Topsail Beach falls within Coastal Barrier Resources System units, which restricts some federal expenditures and flood insurance availability. Verify the current unit boundaries before treating any funding shortfall as purely a matter of town effort — comp towns must be matched on this or it must be controlled for explicitly.
