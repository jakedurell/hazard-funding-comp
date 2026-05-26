-- Use PostGIS extension (run once in DB)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Dimension: canonical geography (towns / places)
CREATE TABLE dim_geography (
  geoid            VARCHAR(32) PRIMARY KEY,   -- Census GEOID (town/place/tract as needed)
  state_fips       CHAR(2)    NOT NULL,
  state_abbr       CHAR(2),
  state_name       TEXT,
  county_fips      CHAR(3),
  place_fips       VARCHAR(10),
  name             TEXT,                      -- canonical name (NAMELSAD)
  geography_type   TEXT,                      -- 'town','county','tract','place', etc.
  aland_sqm        DOUBLE PRECISION,
  awater_sqm       DOUBLE PRECISION,
  area_sqm         DOUBLE PRECISION,
  centroid         GEOMETRY(POINT, 4326),
  geom             GEOMETRY(MultiPolygon, 4326),
  valid_population BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_dim_geography_geom ON dim_geography USING GIST(geom);
CREATE INDEX idx_dim_geography_state ON dim_geography(state_fips);
CREATE INDEX idx_dim_geography_name ON dim_geography USING btree(name);

-- Raw / immutable tables pattern: keep original raw JSON/blobs and provenance
CREATE TABLE raw_acs_file (
  id SERIAL PRIMARY KEY,
  source_file TEXT,
  load_ts TIMESTAMP WITH TIME ZONE DEFAULT now(),
  state_fips CHAR(2),
  raw_json JSONB
);

CREATE TABLE raw_nfip_claims (
  id SERIAL PRIMARY KEY,
  source_file TEXT,
  load_ts TIMESTAMP WITH TIME ZONE DEFAULT now(),
  raw_json JSONB
);

CREATE TABLE raw_nfip_policies (
  id SERIAL PRIMARY KEY,
  source_file TEXT,
  load_ts TIMESTAMP WITH TIME ZONE DEFAULT now(),
  raw_json JSONB
);

CREATE TABLE raw_hma_projects (
  id SERIAL PRIMARY KEY,
  source_file TEXT,
  load_ts TIMESTAMP WITH TIME ZONE DEFAULT now(),
  raw_json JSONB
);

CREATE TABLE raw_nri_tracts (
  id SERIAL PRIMARY KEY,
  source_file TEXT,
  load_ts TIMESTAMP WITH TIME ZONE DEFAULT now(),
  raw_json JSONB
);

CREATE TABLE raw_nfhl_zones (
  id SERIAL PRIMARY KEY,
  source_file TEXT,
  load_ts TIMESTAMP WITH TIME ZONE DEFAULT now(),
  raw_json JSONB,
  geom GEOMETRY
);

-- Staging: cleaned, row-per-observation but still granular
CREATE TABLE stg_acs_town (
  geoid VARCHAR(32),
  state_fips CHAR(2),
  var_name TEXT,
  estimate DOUBLE PRECISION,
  moe DOUBLE PRECISION,
  acs_year INT,
  source_file TEXT,
  load_ts TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (geoid, var_name, acs_year)
);

CREATE INDEX idx_stg_acs_geoid ON stg_acs_town(geoid);

CREATE TABLE stg_nfip_claims (
  claim_id TEXT PRIMARY KEY,
  geoid VARCHAR(32),
  claim_date DATE,
  paid_amount_adj NUMERIC,
  policy_id TEXT,
  source_file TEXT,
  load_ts TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_stg_nfip_geoid ON stg_nfip_claims(geoid);

CREATE TABLE stg_hma_projects (
  project_id TEXT PRIMARY KEY,
  award_date DATE,
  award_amount_adj NUMERIC,
  recipient_name TEXT,
  assigned_geoid VARCHAR(32),
  assigned_level TEXT, -- 'local','regional','statewide','unknown'
  project_type TEXT,
  source_file TEXT,
  load_ts TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Fact / analytic town-level tables (one row per town-state)
CREATE TABLE fact_acs_town (
  geoid VARCHAR(32) PRIMARY KEY REFERENCES dim_geography(geoid),
  state_fips CHAR(2),
  total_population BIGINT,
  total_population_moe DOUBLE PRECISION,
  occupied_housing_units BIGINT,
  occupied_housing_units_moe DOUBLE PRECISION,
  median_income NUMERIC,
  median_income_moe NUMERIC,
  pct_below_poverty DOUBLE PRECISION,
  pct_below_poverty_moe DOUBLE PRECISION,
  percent_elderly DOUBLE PRECISION,
  percent_elderly_moe DOUBLE PRECISION,
  pct_no_vehicle DOUBLE PRECISION,
  pct_no_vehicle_moe DOUBLE PRECISION,
  pct_renter_occupied DOUBLE PRECISION,
  pct_renter_occupied_moe DOUBLE PRECISION,
  pct_mobile_home DOUBLE PRECISION,
  pct_mobile_home_moe DOUBLE PRECISION,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- NFIP & claims aggregations
CREATE TABLE fact_nfip_town AS TABLE fact_acs_town WITH NO DATA; -- clone structure, then alter
ALTER TABLE fact_nfip_town ADD COLUMN nfip_claims_count INT DEFAULT 0;
ALTER TABLE fact_nfip_town ADD COLUMN total_nfip_claims_paid NUMERIC DEFAULT 0;
ALTER TABLE fact_nfip_town ADD COLUMN policies_count INT DEFAULT 0;
ALTER TABLE fact_nfip_town ADD COLUMN insurance_penetration DOUBLE PRECISION DEFAULT 0;
ALTER TABLE fact_nfip_town ADD PRIMARY KEY (geoid);

-- HMA / funding aggregations
CREATE TABLE fact_hma_town (
  geoid VARCHAR(32) PRIMARY KEY REFERENCES dim_geography(geoid),
  funding_total NUMERIC DEFAULT 0,
  funding_per_capita NUMERIC DEFAULT 0,
  funding_by_category JSONB,  -- keep category-level breakdown as JSON
  number_of_properties INT DEFAULT 0,
  number_of_final_properties INT DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Spatial risk source geometries (store in original CRS or 4326; reprojection used for area)
CREATE TABLE river_corridors (
  id SERIAL PRIMARY KEY,
  geom GEOMETRY(MultiPolygon, 4326),
  name TEXT,
  attributes JSONB
);
CREATE INDEX idx_river_corridors_geom ON river_corridors USING GIST(geom);

CREATE TABLE nfhl_zones (
  id SERIAL PRIMARY KEY,
  geom GEOMETRY(MultiPolygon, 4326),
  zone_type TEXT,
  attributes JSONB
);
CREATE INDEX idx_nfhl_zones_geom ON nfhl_zones USING GIST(geom);

CREATE TABLE nri_tracts (
  tract_geoid VARCHAR(32) PRIMARY KEY,
  geom GEOMETRY(MultiPolygon, 4326),
  eal NUMERIC,
  population BIGINT,
  BUILDVALUE NUMERIC,
  AGRIVALUE NUMERIC,
  attributes JSONB
);
CREATE INDEX idx_nri_tracts_geom ON nri_tracts USING GIST(geom);

-- Derived spatial risk aggregated to town
CREATE TABLE fact_spatial_risk_town (
  geoid VARCHAR(32) PRIMARY KEY REFERENCES dim_geography(geoid),
  pct_river_corridor DOUBLE PRECISION,
  pct_high_risk_nfhl DOUBLE PRECISION,
  IFLD_EALT_weighted NUMERIC,
  EAL_per_capita NUMERIC,
  RISK_SCORE_avg DOUBLE PRECISION,
  AREA_weighted DOUBLE PRECISION,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Final merged town-level analytical table (materialized view or table)
CREATE TABLE town_stats (
  geoid VARCHAR(32) PRIMARY KEY REFERENCES dim_geography(geoid),
  town_name TEXT,
  state_fips CHAR(2),
  population BIGINT,
  area_sq_km DOUBLE PRECISION,
  pct_river_corridor DOUBLE PRECISION,
  pct_high_risk_NFHL DOUBLE PRECISION,
  nfhl_covered_flag BOOLEAN,
  median_income NUMERIC,
  total_population BIGINT,
  percent_elderly DOUBLE PRECISION,
  pct_no_vehicle DOUBLE PRECISION,
  occupied_housing_units BIGINT,
  pct_renter_occupied DOUBLE PRECISION,
  pct_bachelors_or_higher DOUBLE PRECISION,
  pct_below_poverty DOUBLE PRECISION,
  percent_with_disability DOUBLE PRECISION,
  pct_mobile_home DOUBLE PRECISION,
  IFLD_EALT_weighted NUMERIC,
  EAL_per_capita NUMERIC,
  RISK_SCORE_avg DOUBLE PRECISION,
  nfip_claims INT,
  total_nfip_claims_paid NUMERIC,
  funding_total NUMERIC,
  funding_per_capita NUMERIC,
  funding_per_occupied_unit NUMERIC,
  funding_by_category JSONB,
  has_funding BOOLEAN,
  vulnerability DOUBLE PRECISION,
  need_eal DOUBLE PRECISION,
  gap_eal DOUBLE PRECISION,
  quadrant_eal TEXT,
  -- model ranks and relative columns as needed
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Example materialized view for export (fast SELECT for CSV/GeoJSON export)
-- CREATE MATERIALIZED VIEW mv_town_export AS
-- SELECT
--   g.geoid,
--   g.name AS town_name,
--   g.state_fips,
--   t.population,
--   ST_AsGeoJSON(ST_Transform(g.geom, 4326)) AS geometry, -- GeoJSON geometry as text
--   s.pct_river_corridor,
--   s.pct_high_risk_nfhl,
--   f.funding_total,
--   r.IFLD_EALT_weighted,
--   r.EAL_per_capita,
--   -- other fields...
--   now() AS exported_at
-- FROM dim_geography g
-- LEFT JOIN town_stats t ON t.geoid = g.geoid
-- LEFT JOIN fact_spatial_risk_town s ON s.geoid = g.geoid
-- LEFT JOIN fact_hma_town f ON f.geoid = g.geoid
-- LEFT JOIN fact_spatial_risk_town r ON r.geoid = g.geoid;

-- Materialized view composing core town-level analytics for export and downstream analysis.
CREATE MATERIALIZED VIEW mv_town_stats AS
SELECT
  g.geoid,
  g.name AS town_name,
  g.state_fips,
  COALESCE(a.total_population, 0) AS population,
  CASE WHEN g.area_sqm IS NOT NULL THEN g.area_sqm / 1e6 ELSE NULL END AS area_sq_km,
  s.pct_river_corridor,
  s.pct_high_risk_nfhl AS pct_high_risk_NFHL,
  s.IFLD_EALT_weighted,
  s.EAL_per_capita,
  s.RISK_SCORE_avg,
  a.median_income,
  a.pct_below_poverty,
  a.percent_elderly,
  a.pct_no_vehicle,
  nf.nfip_claims_count AS nfip_claims,
  nf.total_nfip_claims_paid,
  nf.policies_count AS today_policies,
  h.funding_total,
  h.funding_per_capita,
  h.funding_by_category,
  (h.funding_total > 0) AS has_funding,
  -- Placeholders for model outputs computed in Python or SQL transforms
  NULL::double precision AS need_eal,
  NULL::double precision AS gap_eal,
  NULL::text AS quadrant_eal,
  now() AS last_updated
FROM dim_geography g
LEFT JOIN fact_acs_town a ON a.geoid = g.geoid
LEFT JOIN fact_spatial_risk_town s ON s.geoid = g.geoid
LEFT JOIN fact_nfip_town nf ON nf.geoid = g.geoid
LEFT JOIN fact_hma_town h ON h.geoid = g.geoid;

CREATE UNIQUE INDEX idx_mv_town_stats_geoid ON mv_town_stats(geoid);

-- Refresh guidance:
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_town_stats; -- requires unique index and proper permissions
-- or: REFRESH MATERIALIZED VIEW mv_town_stats;
