#!/usr/bin/env python3
"""Aggregate NFIP claims and policies to town-level `fact_nfip_town`.

Computes per-town total claims paid and claim counts (from `stg_nfip_claims`)
and policy counts (from `raw_nfip_policies` if raw_json contains a `geoid` key).

Usage:
  python 06_aggregate_nfip.py --db-url <DB_URL> [--upsert]
"""
from __future__ import annotations

import argparse
import json
import sys
from typing import Iterable, Dict

import psycopg2
from psycopg2.extras import RealDictCursor, execute_batch


AGG_SQL = """
WITH claims AS (
  SELECT
    COALESCE(geoid, '') AS geoid,
    COUNT(*) AS nfip_claims_count,
    SUM(COALESCE(paid_amount_adj,0))::numeric AS total_nfip_claims_paid
  FROM stg_nfip_claims
  GROUP BY COALESCE(geoid, '')
), policies AS (
  SELECT
    COALESCE(raw_json->>'geoid','') AS geoid,
    COUNT(*) AS policies_count
  FROM raw_nfip_policies
  GROUP BY COALESCE(raw_json->>'geoid','')
)
SELECT
  c.geoid,
  c.nfip_claims_count,
  c.total_nfip_claims_paid,
  COALESCE(p.policies_count,0) AS policies_count,
  a.total_population
FROM claims c
LEFT JOIN policies p ON p.geoid = c.geoid
LEFT JOIN fact_acs_town a ON a.geoid = c.geoid
WHERE c.geoid <> '';
"""

UPSERT_SQL = """
INSERT INTO fact_nfip_town (
  geoid, nfip_claims_count, total_nfip_claims_paid, policies_count, insurance_penetration
)
VALUES (
  %(geoid)s, %(nfip_claims_count)s, %(total_nfip_claims_paid)s, %(policies_count)s, NULL
)
ON CONFLICT (geoid) DO UPDATE SET
  nfip_claims_count = EXCLUDED.nfip_claims_count,
  total_nfip_claims_paid = EXCLUDED.total_nfip_claims_paid,
  policies_count = EXCLUDED.policies_count,
  insurance_penetration = EXCLUDED.insurance_penetration;
"""


def fetch_aggregates(conn) -> Iterable[Dict]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(AGG_SQL)
        return cur.fetchall()


def upsert_rows(conn, rows: Iterable[Dict]):
    params = []
    for r in rows:
        params.append(
            {
                "geoid": r["geoid"],
                "nfip_claims_count": int(r.get("nfip_claims_count") or 0),
                "total_nfip_claims_paid": float(r.get("total_nfip_claims_paid") or 0),
                "policies_count": int(r.get("policies_count") or 0),
            }
        )

    with conn.cursor() as cur:
        execute_batch(cur, UPSERT_SQL, params, page_size=200)
    conn.commit()


def main(argv=None):
    p = argparse.ArgumentParser(description="Aggregate NFIP claims/policies to fact_nfip_town")
    p.add_argument("--db-url", required=True, help="Postgres connection URL")
    p.add_argument("--upsert", action="store_true", help="Write aggregates to fact_nfip_town")
    args = p.parse_args(argv)

    conn = psycopg2.connect(dsn=args.db_url)
    try:
        rows = list(fetch_aggregates(conn))
        print(f"Aggregated {len(rows)} towns from claims")
        if args.upsert:
            upsert_rows(conn, rows)
            print("Upserted aggregates into fact_nfip_town")
        else:
            print("Dry run: use --upsert to write results to DB")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
