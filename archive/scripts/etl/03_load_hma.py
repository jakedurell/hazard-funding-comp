#!/usr/bin/env python3
"""ETL: Load FEMA HMA projects into staging table `stg_hma_projects`.

Reads a cleaned HMA CSV (default: `data/cleaned/fema_hma_projects_clean.csv`)
and upserts rows into `stg_hma_projects` with columns matching the staging table.

Usage:
  python 03_load_hma.py --db-url <DB_URL> [--csv path] [--upsert]

Behavior:
 - Expects a project identifier column (project_id or id).
 - Parses award_date and award_amount_adj numeric column.
 - Uses assigned_geoid if present to attach town; otherwise NULL.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Iterable, Dict

import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch


UPSERT_SQL = """
INSERT INTO stg_hma_projects (
  project_id, award_date, award_amount_adj, recipient_name, assigned_geoid,
  assigned_level, project_type, source_file, load_ts
)
VALUES (
  %(project_id)s, %(award_date)s, %(award_amount_adj)s, %(recipient_name)s,
  %(assigned_geoid)s, %(assigned_level)s, %(project_type)s, %(source_file)s, now()
)
ON CONFLICT (project_id) DO UPDATE SET
  award_date = EXCLUDED.award_date,
  award_amount_adj = EXCLUDED.award_amount_adj,
  recipient_name = EXCLUDED.recipient_name,
  assigned_geoid = EXCLUDED.assigned_geoid,
  assigned_level = EXCLUDED.assigned_level,
  project_type = EXCLUDED.project_type,
  source_file = EXCLUDED.source_file,
  load_ts = now();
"""


def read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, dtype=str)


def normalize_row(row) -> Dict:
    pid = row.get("project_id") or row.get("id") or row.get("PROJECTID")
    award_date = row.get("award_date") or row.get("AwardDate") or None
    # numeric award amount (already inflation-adjusted in your cleaned CSV)
    amt = row.get("award_amount_adj") or row.get("award_amount") or row.get("award_amt_adj")
    try:
        amt_val = float(amt) if amt not in (None, "", "NA") else None
    except Exception:
        amt_val = None

    recipient = row.get("recipient_name") or row.get("recipient") or row.get("recipient_clean")
    assigned_geoid = row.get("assigned_geoid") or row.get("town_geoid") or None
    assigned_level = row.get("assigned_level") or row.get("geo_level") or None
    project_type = row.get("project_type") or row.get("project_category") or None

    return {
        "project_id": pid,
        "award_date": award_date,
        "award_amount_adj": amt_val,
        "recipient_name": recipient,
        "assigned_geoid": assigned_geoid,
        "assigned_level": assigned_level,
        "project_type": project_type,
    }


def upsert_records(conn, records: Iterable[Dict], source_file: str):
    params = []
    for r in records:
        rec = r.copy()
        rec["source_file"] = source_file
        params.append(rec)
    with conn.cursor() as cur:
        execute_batch(cur, UPSERT_SQL, params, page_size=200)
    conn.commit()


def main(argv=None):
    p = argparse.ArgumentParser(description="Load HMA projects into stg_hma_projects")
    p.add_argument("--db-url", required=True, help="Postgres connection URL")
    p.add_argument("--csv", default="data/cleaned/fema_hma_projects_clean.csv", help="HMA cleaned CSV path")
    p.add_argument("--upsert", action="store_true", help="Perform upsert into DB")
    args = p.parse_args(argv)

    path = Path(args.csv)
    if not path.exists():
        print(f"HMA CSV not found: {path}", file=sys.stderr)
        sys.exit(2)

    df = read_csv(path)
    print(f"Rows read: {len(df)}")

    records = []
    for _, row in df.iterrows():
        r = normalize_row(row)
        if not r["project_id"]:
            # skip rows without project id
            continue
        records.append(r)

    print(f"Prepared {len(records)} records")

    if args.upsert:
        conn = psycopg2.connect(dsn=args.db_url)
        try:
            upsert_records(conn, records, source_file=path.name)
        finally:
            conn.close()
        print("Upsert complete")
    else:
        print("Dry run: use --upsert to write to DB")


if __name__ == "__main__":
    main()
