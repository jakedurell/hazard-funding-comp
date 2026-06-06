#!/usr/bin/env python3
"""ETL: Load cleaned ACS CSVs into staging table `stg_acs_town`.

Reads CSV files from a directory (default: `data/cleaned/acs`) and upserts
rows into `stg_acs_town` with columns (geoid, state_fips, var_name, estimate, moe, acs_year, source_file).

Usage:
  python 02_load_acs.py --db-url <DB_URL> [--input-dir data/cleaned/acs] [--year 2020] [--upsert]

Behavior:
 - Detects GEOID column (GEOID, geoid) and attempts to find estimate/moe pairs.
 - If a file contains exactly two non-geoid columns, treats them as estimate/moe.
 - If columns end with '_estimate' and '_moe' (or '_E' and '_M'), pairs them accordingly.
 - The var_name is derived from the filename and/or column base name.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch


UPSERT_SQL = """
INSERT INTO stg_acs_town (geoid, state_fips, var_name, estimate, moe, acs_year, source_file)
VALUES (%(geoid)s, %(state_fips)s, %(var_name)s, %(estimate)s, %(moe)s, %(acs_year)s, %(source_file)s)
ON CONFLICT (geoid, var_name, acs_year) DO UPDATE SET
  estimate = EXCLUDED.estimate,
  moe = EXCLUDED.moe,
  state_fips = EXCLUDED.state_fips,
  source_file = EXCLUDED.source_file,
  load_ts = now();
"""


def detect_geoid_col(df: pd.DataFrame) -> str:
    for c in ("GEOID", "geoid", "Geoid"):
        if c in df.columns:
            return c
    raise RuntimeError("No GEOID column found in ACS CSV")


def pair_estimate_moe_columns(cols: List[str]) -> List[Tuple[str, str]]:
    # find pairs like X_estimate / X_moe, or X_E / X_M
    pairs = []
    lower = [c.lower() for c in cols]
    for i, c in enumerate(cols):
        name = c
        ln = name.lower()
        # skip obvious geoids
        if ln in ("geoid",):
            continue
        # try patterns
        m_est = re.sub(r'(_?estimate$|_?est$|_?e$)', '', ln)
        m_moe = re.sub(r'(_?moe$|_?m$)', '', ln)
    # brute force: if there exists pairs col and col_moe or col_E and col_M
    for c in cols:
        base = None
        if c.endswith("_estimate"):
            base = c[:-9]
            moe = base + "_moe"
            if moe in cols:
                pairs.append((base + "_estimate", moe))
        elif c.endswith("_est"):
            base = c[:-4]
            moe = base + "_moe"
            if moe in cols:
                pairs.append((c, moe))
        elif c.endswith("_e") and c[:-2] + "_m" in cols:
            pairs.append((c, c[:-2] + "_m"))
    return pairs


def process_file(path: Path, acs_year: int) -> List[Dict]:
    df = pd.read_csv(path, dtype=str)
    geoid_col = detect_geoid_col(df)
    cols = [c for c in df.columns if c != geoid_col]

    records = []
    if len(cols) == 2:
        est_col, moe_col = cols[0], cols[1]
        var_label = path.stem
        for _, row in df.iterrows():
            records.append({
                "geoid": row[geoid_col],
                "state_fips": str(row[geoid_col])[0:2],
                "var_name": f"{var_label}.{est_col}",
                "estimate": float(row[est_col]) if row[est_col] not in (None, "", "NA") else None,
                "moe": float(row[moe_col]) if row[moe_col] not in (None, "", "NA") else None,
                "acs_year": acs_year,
                "source_file": str(path.name),
            })
        return records

    # try to detect pairs
    pairs = pair_estimate_moe_columns(cols)
    if pairs:
        for est_col, moe_col in pairs:
            base = est_col.replace("_estimate", "").replace("_est", "")
            var_label = f"{path.stem}.{base}"
            for _, row in df.iterrows():
                records.append({
                    "geoid": row[geoid_col],
                    "state_fips": str(row[geoid_col])[0:2],
                    "var_name": var_label,
                    "estimate": float(row[est_col]) if row[est_col] not in (None, "", "NA") else None,
                    "moe": float(row[moe_col]) if row[moe_col] not in (None, "", "NA") else None,
                    "acs_year": acs_year,
                    "source_file": str(path.name),
                })
        return records

    # fallback: if many columns, pivot wide -> long for numeric columns
    numeric_cols = [c for c in cols if df[c].str.replace(".", "", 1).str.isnumeric().any()]
    for c in numeric_cols:
        var_label = f"{path.stem}.{c}"
        for _, row in df.iterrows():
            val = row[c]
            try:
                valf = float(val) if val not in (None, "", "NA") else None
            except Exception:
                valf = None
            records.append({
                "geoid": row[geoid_col],
                "state_fips": str(row[geoid_col])[0:2],
                "var_name": var_label,
                "estimate": valf,
                "moe": None,
                "acs_year": acs_year,
                "source_file": str(path.name),
            })
    return records


def upsert_records(conn, records: Iterable[Dict]):
    with conn.cursor() as cur:
        execute_batch(cur, UPSERT_SQL, records, page_size=500)
    conn.commit()


def main(argv=None):
    p = argparse.ArgumentParser(description="Load cleaned ACS CSVs into stg_acs_town")
    p.add_argument("--db-url", required=True, help="Postgres connection URL")
    p.add_argument("--input-dir", default="data/cleaned/acs", help="Directory with ACS CSVs")
    p.add_argument("--year", default=2020, type=int, help="ACS year/estimate to record")
    p.add_argument("--upsert", action="store_true", help="Perform upsert into DB")
    args = p.parse_args(argv)

    in_dir = Path(args.input_dir)
    if not in_dir.exists():
        print(f"Input directory not found: {in_dir}", file=sys.stderr)
        sys.exit(2)

    all_records = []
    for pth in sorted(in_dir.glob("*.csv")):
        print(f"Processing {pth.name}")
        try:
            recs = process_file(pth, args.year)
            print(f"  -> {len(recs)} records")
            all_records.extend(recs)
        except Exception as e:
            print(f"  failed to process {pth.name}: {e}", file=sys.stderr)

    if args.upsert:
        conn = psycopg2.connect(dsn=args.db_url)
        try:
            upsert_records(conn, all_records)
        finally:
            conn.close()
        print(f"Upserted {len(all_records)} rows to stg_acs_town")
    else:
        print(f"Dry run: {len(all_records)} total records prepared. Use --upsert to write to DB.")


if __name__ == "__main__":
    main()
