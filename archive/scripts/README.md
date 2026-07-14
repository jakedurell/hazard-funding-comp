# ETL SQL Pipeline (scaffold)

This README summarizes the SQL schema and ETL scripts recently added to this repository. It documents what was created, how to run the ETL/order of operations, dependencies, and recommended next steps.

What was added
- `sql/schema.sql` — Postgres/PostGIS DDL: `dim_geography`, raw/staging tables, analytic fact tables, and materialized views (`mv_town_export`, `mv_town_stats`).
- `scripts/export/export_to_web.py` — query `mv_town_stats` and write `town_stats.csv` and `town_boundaries.geojson` to `docs/static/resources`.
- `scripts/etl/01_load_gis_dim_geography.py` — load town boundaries (`data/cleaned/census.geojson`) into `dim_geography` (area, centroid, geom).
- `scripts/etl/02_load_acs.py` — load cleaned ACS CSVs into `stg_acs_town`.
- `scripts/etl/03_load_hma.py` — load cleaned FEMA HMA projects into `stg_hma_projects`.
- `scripts/etl/04_load_nfip.py` — load NFIP claims into `stg_nfip_claims` and policies into `raw_nfip_policies`.
- `scripts/etl/05_aggregate_hma.py` — aggregate HMA projects to `fact_hma_town`.
- `scripts/etl/06_aggregate_nfip.py` — aggregate NFIP claims/policies to `fact_nfip_town`.
- `scripts/etl/07_aggregate_spatial_risk.py` — spatial overlays & NRI area-weighted aggregation to `fact_spatial_risk_town`.

Quick prerequisites
- PostgreSQL with PostGIS enabled (PostGIS extension created in `sql/schema.sql`).
- Python 3.9+ with: `geopandas`, `pandas`, `psycopg2-binary`, `shapely`.

Install Python deps (example):
```
pip install geopandas pandas psycopg2-binary shapely
```

Typical run order
1. Create DB and run `sql/schema.sql` (DDL).
2. Load GIS boundaries:
   ```
   python scripts/etl/01_load_gis_dim_geography.py --upsert --db-url "postgresql://user:pass@host:5432/db"
   ```
3. Load ACS staging:
   ```
   python scripts/etl/02_load_acs.py --upsert --input-dir data/cleaned/acs --db-url <DB_URL>
   ```
4. Load NFIP and HMA raw/staging:
   ```
   python scripts/etl/04_load_nfip.py --upsert --db-url <DB_URL>
   python scripts/etl/03_load_hma.py --upsert --db-url <DB_URL>
   ```
5. Aggregate HMA / NFIP:
   ```
   python scripts/etl/05_aggregate_hma.py --upsert --db-url <DB_URL>
   python scripts/etl/06_aggregate_nfip.py --upsert --db-url <DB_URL>
   ```
6. Aggregate spatial risk (NRI / NFHL / river corridors):
   ```
   python scripts/etl/07_aggregate_spatial_risk.py --upsert --db-url <DB_URL>
   ```
7. Refresh materialized views (in DB):
   ```sql
   REFRESH MATERIALIZED VIEW mv_town_stats;
   -- or: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_town_stats;
   ```
8. Export CSV + GeoJSON:
   ```
   python scripts/export/export_to_web.py --db-url <DB_URL>
   ```

Notes & caveats
- The scripts are idempotent when using `--upsert` (use ON CONFLICT upserts). For very large inputs, consider bulk `COPY` and SQL-based upserts.
- Spatial area calculations use EPSG:5070 internally (equal-area) and store/publish GeoJSON in EPSG:4326.
- Column-name detection in ACS/NFIP/HMA loaders uses heuristics; adjust if your cleaned CSVs use different column names.
- Multi-state support: `dim_geography` includes `state_fips`. Most scripts are parameterizable; pass `--state` enhancements can be added.

Next steps (recommended)
- Add small integration tests and validation checks (row counts, population sums).
- Add a `requirements.txt` or `pyproject.toml` for reproducible environments.
- Optionally scaffold a `docker-compose.yml` for a local Postgres+PostGIS instance.
- Implement model-building (need/gap/quadrant) as SQL functions or a Python step that reads `mv_town_stats`, computes model columns, and writes back to `town_stats` or a derived view.
