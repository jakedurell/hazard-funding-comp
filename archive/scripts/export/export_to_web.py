#!/usr/bin/env python3
"""Export town-level materialized view to CSV and GeoJSON.

Usage:
  python export_to_web.py --db-url postgresql://user:pass@host:5432/dbname

The script queries a materialized view (default: `mv_town_stats`) and
writes `town_stats.csv` and `town_boundaries.geojson` to an output folder
(default: `docs/static/resources`).
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys

import psycopg2
import psycopg2.extras
import pandas as pd


def fetch_view_rows(conn, view_name: str):
    # join dim_geography to pull GeoJSON geometry for export
    sql = f"SELECT v.*, ST_AsGeoJSON(ST_Transform(g.geom, 4326)) AS geometry "
    sql += f"FROM {view_name} v LEFT JOIN dim_geography g ON g.geoid = v.geoid;"
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql)
        return cur.fetchall()


def write_csv(rows, out_path: Path):
    if not rows:
        print("No rows returned from view; skipping CSV write.")
        return
    df = pd.DataFrame(rows)
    # if geometry is present, drop it from the CSV (keep full properties only)
    if "geometry" in df.columns:
        df = df.drop(columns=["geometry"])
    df.to_csv(out_path / "town_stats.csv", index=False)
    print(f"Wrote CSV: {out_path / 'town_stats.csv'}")


def write_geojson(rows, out_path: Path):
    features = []
    for r in rows:
        geom = None
        if r.get("geometry"):
            try:
                geom = json.loads(r["geometry"]) if isinstance(r["geometry"], str) else r["geometry"]
            except Exception:
                geom = None
        props = {k: v for k, v in r.items() if k != "geometry"}
        features.append({
            "type": "Feature",
            "geometry": geom,
            "properties": props,
        })
    fc = {"type": "FeatureCollection", "features": features}
    with open(out_path / "town_boundaries.geojson", "w", encoding="utf8") as fh:
        json.dump(fc, fh)
    print(f"Wrote GeoJSON: {out_path / 'town_boundaries.geojson'}")


def main():
    p = argparse.ArgumentParser(description="Export materialized view to CSV + GeoJSON")
    p.add_argument("--db-url", required=True, help="Postgres connection URL")
    p.add_argument("--view", default="mv_town_stats", help="Materialized view name to query")
    p.add_argument("--out-dir", default="docs/static/resources", help="Output directory for exports")
    args = p.parse_args()

    out_path = Path(args.out_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    try:
        conn = psycopg2.connect(dsn=args.db_url)
    except Exception as e:
        print("Failed to connect to database:", e, file=sys.stderr)
        sys.exit(2)

    rows = fetch_view_rows(conn, args.view)
    write_csv(rows, out_path)
    write_geojson(rows, out_path)

    conn.close()


if __name__ == "__main__":
    main()
