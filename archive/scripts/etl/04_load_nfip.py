#!/usr/bin/env python3
"""ETL: Load NFIP claims and policies.

 - Loads claims CSV into `stg_nfip_claims` (upsert by claim_id)
 - Loads policies CSV into `raw_nfip_policies` as JSONB records (keeps raw provenance)

Usage:
  python 04_load_nfip.py --db-url <DB_URL> [--claims path] [--policies path] [--upsert]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Iterable, Dict

import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch


UPSERT_CLAIM_SQL = """
INSERT INTO stg_nfip_claims (
  claim_id, geoid, claim_date, paid_amount_adj, policy_id, source_file, load_ts
)
VALUES (
  %(claim_id)s, %(geoid)s, %(claim_date)s, %(paid_amount_adj)s, %(policy_id)s, %(source_file)s, now()
)
ON CONFLICT (claim_id) DO UPDATE SET
  geoid = EXCLUDED.geoid,
  claim_date = EXCLUDED.claim_date,
  paid_amount_adj = EXCLUDED.paid_amount_adj,
  policy_id = EXCLUDED.policy_id,
  source_file = EXCLUDED.source_file,
  load_ts = now();
"""

INSERT_RAW_POLICY_SQL = "INSERT INTO raw_nfip_policies (source_file, load_ts, raw_json) VALUES (%(source_file)s, now(), %(raw_json)s);"


def read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, dtype=str)


def normalize_claim_row(row) -> Dict:
    cid = row.get("claim_id") or row.get("ClaimID") or row.get("CLAIM_ID") or row.get("claim_number")
    geoid = row.get("geoid") or row.get("GEOID") or row.get("FIPS")
    claim_date = row.get("claim_date") or row.get("date") or None
    paid = row.get("paid_amount_adj") or row.get("paid_amount") or row.get("paid")
    try:
        paid_val = float(paid) if paid not in (None, "", "NA") else None
    except Exception:
        paid_val = None
    policy_id = row.get("policy_id") or row.get("policy") or None
    return {
        "claim_id": cid,
        "geoid": geoid,
        "claim_date": claim_date,
        "paid_amount_adj": paid_val,
        "policy_id": policy_id,
    }


def upsert_claims(conn, records: Iterable[Dict], source_file: str):
    params = []
    for r in records:
        rec = r.copy()
        rec["source_file"] = source_file
        params.append(rec)
    with conn.cursor() as cur:
        execute_batch(cur, UPSERT_CLAIM_SQL, params, page_size=200)
    conn.commit()


def insert_raw_policies(conn, records: Iterable[Dict], source_file: str):
    params = [{"source_file": source_file, "raw_json": json.dumps(r)} for r in records]
    with conn.cursor() as cur:
        execute_batch(cur, INSERT_RAW_POLICY_SQL, params, page_size=200)
    conn.commit()


def main(argv=None):
    p = argparse.ArgumentParser(description="Load NFIP claims and policies into staging/raw tables")
    p.add_argument("--db-url", required=True, help="Postgres connection URL")
    p.add_argument("--claims", default="data/cleaned/nfip_claims.csv", help="Claims CSV path")
    p.add_argument("--policies", default="data/cleaned/nfip_policies.csv", help="Policies CSV path")
    p.add_argument("--upsert", action="store_true", help="Perform DB writes")
    args = p.parse_args(argv)

    claims_path = Path(args.claims)
    policies_path = Path(args.policies)

    claim_records = []
    if claims_path.exists():
        dfc = read_csv(claims_path)
        print(f"Claims rows read: {len(dfc)}")
        for _, row in dfc.iterrows():
            rec = normalize_claim_row(row)
            if rec["claim_id"]:
                claim_records.append(rec)
    else:
        print(f"Claims file not found: {claims_path}")

    policy_records = []
    if policies_path.exists():
        dfp = read_csv(policies_path)
        print(f"Policies rows read: {len(dfp)}")
        # convert each row to dict for raw storage
        policy_records = [row.dropna().to_dict() for _, row in dfp.iterrows()]
    else:
        print(f"Policies file not found: {policies_path}")

    if args.upsert:
        conn = psycopg2.connect(dsn=args.db_url)
        try:
            if claim_records:
                upsert_claims(conn, claim_records, source_file=claims_path.name)
                print(f"Upserted {len(claim_records)} claim rows")
            if policy_records:
                insert_raw_policies(conn, policy_records, source_file=policies_path.name)
                print(f"Inserted {len(policy_records)} policy raw rows")
        finally:
            conn.close()
    else:
        print(f"Dry run: {len(claim_records)} claims prepared, {len(policy_records)} policies prepared. Use --upsert to write to DB.")


if __name__ == "__main__":
    main()
