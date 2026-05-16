# Front-End Export Data Dictionary

## Exported Web Application Datasets

This export step produces the flat CSV (`town_stats.csv`) and simplified GeoJSON (`town_boundaries.geojson`) used by the interactive dashboard. The outputs are optimized for fast loading, client-side filtering, choropleth rendering, rankings, and tooltip/pop-up display in the web application.

### `town_boundaries.geojson` Data Dictionary

Simplified geographic boundary layer used for map rendering and spatial interaction in the dashboard.

- **GEOID**: Unique 10-digit Census identifier for the town (FIPS code).
- **town_name**: Full Census town name (`NAMELSAD`) used for map labels and joins.
- **geometry**: Polygon or multipolygon geometry representing town boundaries in WGS84 (EPSG:4326) for web mapping compatibility.

### `town_stats.csv` Data Dictionary

Flat table containing town-level metrics, model outputs, rankings, relative scaling values, and categorical classifications used throughout the dashboard.

#### Base Town Variables

- **GEOID**: Unique 10-digit Census identifier for the town (FIPS code).
- **town_name**: Standardized town name used across all merged datasets.
- **population**: Total resident population of the town.
- **valid_population**: Boolean flag indicating whether the town has a nonzero population (True if population > 0).
- **area_sq_km**: Town land area calculated from projected geometry (EPSG:5070) and converted to square kilometers.
- **pct_river_corridor**: Percentage of town area within Vermont river corridor polygons.
- **pct_below_poverty**: Percentage of population below the federal poverty line.
- **percent_elderly**: Percentage of population age 65 and older.
- **pct_no_vehicle**: Percentage of occupied households without a vehicle available.
- **pct_renter_occupied**: Percentage of occupied housing units that are renter-occupied.
- **median_income**: Median household income in inflation-adjusted dollars.
- **IFLD_EALT_weighted**: FEMA National Risk Index Expected Annual Loss (EAL) estimate for flood risk, weighted and aggregated to the town level.
- **EAL_per_capita**: Expected annual flood loss divided by town population (USD/person).

#### Raw Index Variables

These variables are direct outputs of the ranking/index models prior to additional scaling.

##### Risk Indices

- **risk_eal**: Flood risk index derived from FEMA Expected Annual Loss (`IFLD_EALT_weighted`).
- **risk_eal_per_capita**: Flood risk index derived from Expected Annual Loss normalized by population.
- **risk_nri**: Flood risk index derived from FEMA National Risk Index composite risk score.

##### Need Indices

Combined measures of physical flood risk and social vulnerability.

- **need_eal**: Need index combining EAL flood risk with vulnerability indicators.
- **need_eal_per_capita**: Need index combining per-capita EAL risk with vulnerability indicators.
- **need_nri**: Need index combining FEMA National Risk Index risk score with vulnerability indicators.

#### Funding Gap Indices

Positive values indicate towns receiving less funding relative to modeled need; negative values indicate comparatively higher funding.

- **gap_eal**: Funding gap based on the EAL model.
- **gap_eal_per_capita**: Funding gap based on the per-capita EAL model.
- **gap_nri**: Funding gap based on the FEMA National Risk Index model.

#### Funding and Claims Variables

- **funding_total**: Total FEMA mitigation funding obligated to the town (inflation-adjusted USD).
- **funding_per_capita**: FEMA mitigation funding normalized by population (USD/person).
- **claims_paid_per_capita**: NFIP claims paid normalized by population (USD/person).

#### Vulnerability Index

- **vulnerability**: Composite social vulnerability index derived from the percentile-ranked components:
	- poverty rate
	- elderly population share
	- households without vehicles

All component variables are percentile-ranked before averaging.

#### Relative-to-State Metrics

These variables are scaled relative to the statewide average to support choropleth visualization and intuitive interpretation in the dashboard.

Values are centered around 0:

- `0` = approximately statewide average
- positive values = above statewide average
- negative values = below statewide average

##### Relative Risk Metrics

- `risk_eal_rel`
- `risk_eal_per_capita_rel`
- `risk_nri_rel`

##### Relative Need Metrics

- `need_eal_rel`
- `need_eal_per_capita_rel`
- `need_nri_rel`

##### Relative Funding Gap Metrics

Gap variables are scaled by mean absolute gap magnitude rather than statewide mean because funding gaps are inherently zero-centered.

- `gap_eal_rel`
- `gap_eal_per_capita_rel`
- `gap_nri_rel`

**Interpretation:**

- positive values = more underfunded relative to modeled need
- negative values = more funded relative to modeled need
- magnitude reflects deviation from a “typical” funding mismatch

##### Relative Funding / Claims / Vulnerability Metrics

- `funding_rel`: Log-scaled funding relative to statewide average funding.
- `claims_rel`: Log-scaled NFIP claims relative to statewide average claims.
- `vulnerability_rel`: Vulnerability index relative to statewide average vulnerability.

#### Rank Variables

All rank variables are percentile ranks scaled from 0–1.

General interpretation:

- `1.0` = highest / worst / most extreme value
- `0.0` = lowest value

##### Funding and Claims Ranks

- `funding_rank`: Relative ranking of FEMA mitigation funding per capita.
- `claims_rank`: Relative ranking of NFIP claims paid per capita.
- `vulnerability_rank`: Relative ranking of composite vulnerability.

##### Risk Ranks

- `risk_rank_eal`
- `risk_rank_eal_per_capita`
- `risk_rank_nri`

##### Need Ranks

- `need_rank_eal`
- `need_rank_eal_per_capita`
- `need_rank_nri`

##### Funding Gap Ranks

Higher values indicate towns more underfunded relative to modeled need.

- `gap_rank_eal`
- `gap_rank_eal_per_capita`
- `gap_rank_nri`

#### Quadrant Classification Variables

Categorical classifications assigning towns into need/funding relationship groups for dashboard visualizations.

##### Quadrant Categories

- `zero_funding`: Town received no FEMA mitigation funding.
- `underfunded`: High modeled need and comparatively low funding.
- `aligned`: High modeled need and comparatively high funding.
- `overfunded`: Low modeled need and comparatively high funding.
- `low_priority`: Low modeled need and comparatively low funding.

##### Model-Specific Quadrants

- `quadrant_eal`: Quadrant classification using the EAL model.
- `quadrant_eal_per_capita`: Quadrant classification using the per-capita EAL model.
- `quadrant_nri`: Quadrant classification using the FEMA National Risk Index model.

#### Statewide Summary Row

The exported CSV includes an appended synthetic summary row:

- `town_name` = "State of Vermont"

This row contains statewide aggregate metrics used as dashboard reference values.

##### Statewide Calculations

Population-weighted averages are used for:

- risk
- need
- vulnerability
- demographic indicators
- per-capita metrics

Total sums are used for:

- population
- FEMA funding
- Expected Annual Loss

Rank values represent the percentile location of the statewide average within the distribution of Vermont towns.

#### Index Construction Notes

##### Rank Normalization

All index components are normalized using percentile ranks prior to aggregation:

- `rank(pct=True)`

This approach:

- reduces sensitivity to extreme outliers
- preserves ordinal relationships
- allows variables with different units and distributions to be combined

##### Need Index Formula

Need indices combine normalized risk and vulnerability components:

$$
\mathrm{Need\ Index} = \frac{\mathrm{Risk\ Index} + \mathrm{Vulnerability\ Index}}{n_{\mathrm{components}}}
$$

Where $n_{\mathrm{components}}$ is the count of components combined for the model specification.

##### Funding Gap Formula

Funding gaps compare modeled need against normalized funding:

$$
\mathrm{Gap\ Index} = \mathrm{Need\ Index} - \mathrm{Funding\ Rank}
$$

Positive values indicate relative underfunding.

##### Relative Scaling Formula

Most “relative” variables are scaled around the statewide mean:

$$
\mathrm{Relative\ Value} = \frac{x}{\bar{x}} - 1
$$

