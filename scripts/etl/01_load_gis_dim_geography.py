#!/usr/bin/env python3
"""ETL: Load GIS town boundaries into `dim_geography`.

Reads a GeoJSON (default: `data/cleaned/census.geojson`), computes area
in square meters (equal-area EPSG:5070), centroid (EPSG:4326), and upserts
records into the `dim_geography` table.

Usage:
  python 01_load_gis_dim_geography.py --db-url <DB_URL> [--geojson path] [--upsert]

Dependencies: geopandas, psycopg2, shapely, pandas
Install with: pip install geopandas psycopg2-binary pandas
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict

import geopandas as gpd
import pandas as pd
import psycopg2
from shapely.geometry import mapping
from psycopg2.extras import execute_batch


def detect_geoid_col(gdf: gpd.GeoDataFrame) -> str:
    for c in ("GEOID", "geoid", "GEOID10", "GEOID20"):
        if c in gdf.columns:
            return c
    raise RuntimeError("No GEOID column found in GeoJSON. Expected 'GEOID' or similar.")


def detect_name_col(gdf: gpd.GeoDataFrame) -> str:
    for c in ("NAMELSAD", "name", "town_name", "NAME"):
        if c in gdf.columns:
            return c
    return "name"


def prepare_rows(gdf: gpd.GeoDataFrame) -> pd.DataFrame:
    # Ensure CRS; assume 4326 if missing
    if gdf.crs is None:
        gdf = gdf.set_crs("EPSG:4326")

    geoid_col = detect_geoid_col(gdf)
    name_col = detect_name_col(gdf)

    # compute equal-area areas in EPSG:5070
    gdf_ea = gdf.to_crs("EPSG:5070")
    gdf["area_sqm"] = gdf_ea.geometry.area

    # compute centroid in 4326
    gdf_4326 = gdf.to_crs("EPSG:4326")
    gdf["centroid_lon"] = gdf_4326.geometry.centroid.x
    gdf["centroid_lat"] = gdf_4326.geometry.centroid.y

    # use existing ALAND/AWATER if present (common in census shapefiles)
    aland_cols = [c for c in ("ALAND", "aland_sqm", "aland_sqm") if c in gdf.columns]
    awater_cols = [c for c in ("AWATER", "awater_sqm", "awater_sqm") if c in gdf.columns]
    if aland_cols:
        gdf["aland_sqm"] = gdf[aland_cols[0]].astype(float)
    else:
        gdf["aland_sqm"] = gdf["area_sqm"]
    if awater_cols:
        gdf["awater_sqm"] = gdf[awater_cols[0]].astype(float)
    else:
        gdf["awater_sqm"] = 0.0

    # geometry as GeoJSON text
    gdf["geom_geojson"] = gdf.geometry.apply(lambda g: json.dumps(mapping(g)))

    out = gdf[[geoid_col, name_col, "area_sqm", "aland_sqm", "awater_sqm", "centroid_lon", "centroid_lat", "geom_geojson"]].copy()
    out = out.rename(columns={geoid_col: "geoid", name_col: "name"})
    out["state_fips"] = out["geoid"].astype(str).str.slice(0, 2)
    return out


UPSERT_SQL = """
INSERT INTO dim_geography (
    geoid, state_fips, state_abbr, state_name, county_fips, place_fips,
    name, geography_type, aland_sqm, awater_sqm, area_sqm, centroid, geom, created_at
)
VALUES (
    %(geoid)s, %(state_fips)s, NULL, NULL, NULL, NULL,
    %(name)s, 'town', %(aland_sqm)s, %(awater_sqm)s, %(area_sqm)s,
    ST_SetSRID(ST_MakePoint(%(centroid_lon)s, %(centroid_lat)s), 4326),
    ST_SetSRID(ST_GeomFromGeoJSON(%(geom_geojson)s), 4326), now()
)
ON CONFLICT (geoid) DO UPDATE SET
  state_fips = EXCLUDED.state_fips,
  name = EXCLUDED.name,
  aland_sqm = EXCLUDED.aland_sqm,
  awater_sqm = EXCLUDED.awater_sqm,
  area_sqm = EXCLUDED.area_sqm,
  centroid = EXCLUDED.centroid,
  geom = EXCLUDED.geom,
  last_updated = now();
"""


def upsert_dim_geography(conn, df: pd.DataFrame):
    records = df.to_dict(orient="records")
    with conn.cursor() as cur:
        execute_batch(cur, UPSERT_SQL, records, page_size=100)
    conn.commit()


def main(argv=None):
    p = argparse.ArgumentParser(description="Load census GeoJSON into dim_geography")
    p.add_argument("--db-url", required=True, help="Postgres connection URL")
    p.add_argument("--geojson", default="data/cleaned/census.geojson", help="Path to census GeoJSON")
    p.add_argument("--upsert", action="store_true", help="Perform upsert into dim_geography")
    args = p.parse_args(argv)

    geojson_path = Path(args.geojson)
    if not geojson_path.exists():
        print(f"GeoJSON not found: {geojson_path}", file=sys.stderr)
        sys.exit(2)

    print(f"Reading GeoJSON: {geojson_path}")
    gdf = gpd.read_file(str(geojson_path))
    print(f"Rows read: {len(gdf)}")

    df = prepare_rows(gdf)
    print(f"Prepared {len(df)} rows for upsert")

    if args.upsert:
        conn = psycopg2.connect(dsn=args.db_url)
        try:
            upsert_dim_geography(conn, df)
        finally:
            conn.close()
        print("Upsert complete.")
    else:
        print("--upsert flag not provided; dry run complete. Use --upsert to write to DB.")


if __name__ == "__main__":
    main()
