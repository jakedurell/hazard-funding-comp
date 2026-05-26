#!/usr/bin/env python3
"""Aggregate spatial risk layers (river corridors, NFHL, NRI) to towns.

Computes per-town:
 - pct_river_corridor (fraction of town area overlapping river corridors)
 - pct_high_risk_nfhl (fraction overlapping NFHL high-risk zones)
 - IFLD_EALT_weighted (area-weighted sum of tract EAL)
 - EAL_per_capita (IFLD_EALT_weighted / population)
 - RISK_SCORE_avg (area-weighted average of tract risk score)

Writes results to `fact_spatial_risk_town` (upsert).

Usage:
  python 07_aggregate_spatial_risk.py --db-url <DB_URL> [--upsert]
"""
from __future__ import annotations

import argparse
import json
import sys
from typing import Iterable, Dict

import psycopg2
from psycopg2.extras import RealDictCursor, execute_batch


AGG_SQL = r"""
WITH
towns AS (
  SELECT geoid, geom, ST_Area(ST_Transform(geom, 5070)) AS town_area_5070
  FROM dim_geography
  WHERE geom IS NOT NULL
),
river_inter AS (
  SELECT t.geoid, SUM(ST_Area(ST_Intersection(ST_Transform(t.geom,5070), ST_Transform(r.geom,5070)))) AS inter_area
  FROM towns t
  JOIN river_corridors r ON ST_Intersects(t.geom, r.geom)
  GROUP BY t.geoid
),
nfhl_inter AS (
  SELECT t.geoid, SUM(ST_Area(ST_Intersection(ST_Transform(t.geom,5070), ST_Transform(n.geom,5070)))) AS inter_area
  FROM towns t
  JOIN nfhl_zones n ON ST_Intersects(t.geom, n.geom)
  WHERE COALESCE(n.zone_type, '') IN ('AE','A','VE','AH','AO')
  GROUP BY t.geoid
),
-- NRI tract <-> town intersections and area-weighted allocation
nri_inter AS (
  SELECT
    n.tract_geoid,
    t.geoid,
    ST_Area(ST_Intersection(ST_Transform(n.geom,5070), ST_Transform(t.geom,5070))) AS inter_area,
    ST_Area(ST_Transform(n.geom,5070)) AS tract_area,
    COALESCE(n.eal,0)::numeric AS eal,
    COALESCE(n.population,0)::numeric AS pop,
    COALESCE(n.buildvalue,0)::numeric AS buildvalue,
    COALESCE(n.agrivalue,0)::numeric AS agrivalue,
    (n.attributes ->> 'RISK_SCORE')::double precision AS risk_score
  FROM nri_tracts n
  JOIN dim_geography t ON ST_Intersects(n.geom, t.geom)
),
-- compute raw weight per tract-town pair, filter slivers (<1% of tract area)
nri_weighted AS (
  SELECT
    tract_geoid,
    geoid,
    inter_area,
    tract_area,
    CASE WHEN tract_area > 0 THEN inter_area/tract_area ELSE 0 END AS raw_weight
  FROM nri_inter
),
-- sum raw weights per tract (after filtering slivers)
nri_filtered AS (
  SELECT w.tract_geoid, w.geoid, w.inter_area, w.tract_area, w.raw_weight
  FROM nri_weighted w
  WHERE CASE WHEN w.tract_area > 0 THEN w.raw_weight >= 0.01 ELSE false END
),
nri_sum AS (
  SELECT tract_geoid, SUM(raw_weight) AS sum_weight
  FROM nri_filtered
  GROUP BY tract_geoid
),
-- normalized weight: if sum_weight > 0 then raw_weight/sum_weight else raw_weight
nri_norm AS (
  SELECT f.geoid, f.tract_geoid, f.inter_area, f.tract_area,
    CASE WHEN s.sum_weight IS NOT NULL AND s.sum_weight > 0 THEN f.raw_weight / s.sum_weight
         ELSE f.raw_weight END AS weight
  FROM nri_filtered f
  LEFT JOIN nri_sum s ON s.tract_geoid = f.tract_geoid
),
-- join back numeric attributes from nri_inter for aggregation
nri_attrs AS (
  SELECT n.geoid,
    SUM(ni.weight * ni.inter_area) AS AREA_weighted,
    SUM(ni.weight * COALESCE(r.eal,0)) AS IFLD_EALT_weighted,
    SUM(ni.weight * COALESCE(r.pop,0)) AS POPULATION_weighted,
    SUM(ni.weight * COALESCE(r.buildvalue,0)) AS BUILDVALUE_weighted,
    SUM(ni.weight * COALESCE(r.agrivalue,0)) AS AGRIVALUE_weighted,
    CASE WHEN SUM(ni.weight) > 0 THEN SUM( (r.risk_score) * ni.weight ) / SUM(ni.weight) ELSE NULL END AS RISK_SCORE_avg
  FROM nri_norm ni
  JOIN nri_inter r ON r.tract_geoid = ni.tract_geoid AND r.geoid = ni.geoid
  GROUP BY n.geoid
)
SELECT
  t.geoid,
  COALESCE(ric.inter_area / t.town_area_5070, 0.0) AS pct_river_corridor,
  COALESCE(nf.inter_area / t.town_area_5070, 0.0) AS pct_high_risk_nfhl,
  COALESCE(na.IFLD_EALT_weighted,0) AS IFLD_EALT_weighted,
  CASE WHEN COALESCE(na.POPULATION_weighted,0) > 0 THEN (COALESCE(na.IFLD_EALT_weighted,0) / COALESCE(na.POPULATION_weighted,0)) ELSE NULL END AS EAL_per_capita,
  COALESCE(na.RISK_SCORE_avg, NULL) AS RISK_SCORE_avg,
  COALESCE(na.AREA_weighted,0) AS AREA_weighted
FROM towns t
LEFT JOIN river_inter ric ON ric.geoid = t.geoid
LEFT JOIN nfhl_inter nf ON nf.geoid = t.geoid
LEFT JOIN nri_attrs na ON na.geoid = t.geoid;
"""

UPSERT_SQL = """
INSERT INTO fact_spatial_risk_town (
  geoid, pct_river_corridor, pct_high_risk_nfhl, IFLD_EALT_weighted,
  EAL_per_capita, RISK_SCORE_avg, AREA_weighted, last_updated
)
VALUES (
  %(geoid)s, %(pct_river_corridor)s, %(pct_high_risk_nfhl)s, %(IFLD_EALT_weighted)s,
  %(EAL_per_capita)s, %(RISK_SCORE_avg)s, %(AREA_weighted)s, now()
)
ON CONFLICT (geoid) DO UPDATE SET
  pct_river_corridor = EXCLUDED.pct_river_corridor,
  pct_high_risk_nfhl = EXCLUDED.pct_high_risk_nfhl,
  IFLD_EALT_weighted = EXCLUDED.IFLD_EALT_weighted,
  EAL_per_capita = EXCLUDED.EAL_per_capita,
  RISK_SCORE_avg = EXCLUDED.RISK_SCORE_avg,
  AREA_weighted = EXCLUDED.AREA_weighted,
  last_updated = now();
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
                "pct_river_corridor": float(r.get("pct_river_corridor") or 0),
                "pct_high_risk_nfhl": float(r.get("pct_high_risk_nfhl") or 0),
                "IFLD_EALT_weighted": float(r.get("IFLD_EALT_weighted") or 0),
                "EAL_per_capita": float(r.get("EAL_per_capita") ) if r.get("EAL_per_capita") is not None else None,
                "RISK_SCORE_avg": float(r.get("RISK_SCORE_avg")) if r.get("RISK_SCORE_avg") is not None else None,
                "AREA_weighted": float(r.get("AREA_weighted") or 0),
            }
        )

    with conn.cursor() as cur:
        execute_batch(cur, UPSERT_SQL, params, page_size=200)
    conn.commit()


def main(argv=None):
    p = argparse.ArgumentParser(description="Aggregate spatial risk layers to fact_spatial_risk_town")
    p.add_argument("--db-url", required=True, help="Postgres connection URL")
    p.add_argument("--upsert", action="store_true", help="Write aggregates to DB")
    args = p.parse_args(argv)

    conn = psycopg2.connect(dsn=args.db_url)
    try:
        rows = list(fetch_aggregates(conn))
        print(f"Computed spatial aggregates for {len(rows)} towns")
        if args.upsert:
            upsert_rows(conn, rows)
            print("Upserted spatial risk aggregates into fact_spatial_risk_town")
        else:
            print("Dry run: use --upsert to write results to DB")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
