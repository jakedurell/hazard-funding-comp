#!/usr/bin/env python3
"""Aggregate HMA projects from `stg_hma_projects` into `fact_hma_town`.

This script computes per-town funding totals, project counts, and a JSON
breakdown of funding by `project_type`. If `fact_acs_town` contains
population, it also computes `funding_per_capita`.

Usage:
  python 05_aggregate_hma.py --db-url <DB_URL> [--upsert]
"""
from __future__ import annotations

import argparse
import json
import sys
from typing import Iterable, Dict

import psycopg2
from psycopg2.extras import RealDictCursor, execute_batch


AGG_SQL = """
WITH project_sums AS (
  SELECT
    COALESCE(assigned_geoid, '') AS geoid,
    COALESCE(project_type, 'unknown') AS project_type,
    SUM(COALESCE(award_amount_adj,0))::numeric AS amt,
    COUNT(*) AS projects
  FROM stg_hma_projects
  GROUP BY COALESCE(assigned_geoid, ''), COALESCE(project_type, 'unknown')
), town_agg AS (
  SELECT
    geoid,
    SUM(amt) AS funding_total,
    SUM(projects) AS num_projects,
    jsonb_object_agg(project_type, amt) FILTER (WHERE project_type IS NOT NULL) AS funding_by_category
  FROM project_sums
  GROUP BY geoid
)
SELECT
  t.geoid,
  t.funding_total,
  t.num_projects,
  COALESCE(t.funding_by_category, '{}'::jsonb) AS funding_by_category,
  a.total_population
FROM town_agg t
LEFT JOIN fact_acs_town a ON a.geoid = t.geoid
WHERE t.geoid <> '';
"""

UPSERT_SQL = """
INSERT INTO fact_hma_town (
  geoid, funding_total, funding_per_capita, funding_by_category, number_of_properties, number_of_final_properties, last_updated
)
VALUES (
  %(geoid)s, %(funding_total)s, %(funding_per_capita)s, %(funding_by_category)s, %(number_of_properties)s, %(number_of_final_properties)s, now()
)
ON CONFLICT (geoid) DO UPDATE SET
  funding_total = EXCLUDED.funding_total,
  funding_per_capita = EXCLUDED.funding_per_capita,
  funding_by_category = EXCLUDED.funding_by_category,
  number_of_properties = EXCLUDED.number_of_properties,
  number_of_final_properties = EXCLUDED.number_of_final_properties,
  last_updated = now();
"""


def fetch_aggregates(conn) -> Iterable[Dict]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(AGG_SQL)
        return cur.fetchall()


def upsert_rows(conn, rows: Iterable[Dict]):
    params = []
    for r in rows:
        funding_total = r.get("funding_total") or 0
        pop = r.get("total_population")
        funding_per_capita = None
        try:
            if pop and float(pop) > 0:
                funding_per_capita = float(funding_total) / float(pop)
        except Exception:
            funding_per_capita = None

        params.append(
            {
                "geoid": r["geoid"],
                "funding_total": funding_total,
                "funding_per_capita": funding_per_capita,
                "funding_by_category": json.dumps(r.get("funding_by_category") or {}),
                "number_of_properties": None,
                "number_of_final_properties": None,
            }
        )

    with conn.cursor() as cur:
        execute_batch(cur, UPSERT_SQL, params, page_size=200)
    conn.commit()


def main(argv=None):
    p = argparse.ArgumentParser(description="Aggregate HMA projects to fact_hma_town")
    p.add_argument("--db-url", required=True, help="Postgres connection URL")
    p.add_argument("--upsert", action="store_true", help="Write aggregates to fact_hma_town")
    args = p.parse_args(argv)

    conn = psycopg2.connect(dsn=args.db_url)
    try:
        rows = fetch_aggregates(conn)
        print(f"Aggregated {len(rows)} towns")
        if args.upsert:
            upsert_rows(conn, rows)
            print("Upserted aggregates into fact_hma_town")
        else:
            print("Dry run: use --upsert to write results to DB")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
