
## Technical Methodology Appendix

This analysis evaluates whether flood mitigation funding in Vermont aligns with underlying need. “Need” is treated as a normative construct (what funding should target), while observed funding patterns reflect real-world allocation dynamics. Models are used as validation tools, not as ends in themselves.

### Data Sources

This project integrates multiple federal and spatial datasets at the town level:
- FEMA National Risk Index (NRI) – expected annual loss (EAL), risk, vulnerability, and resilience indicators
- FEMA Hazard Mitigation Assistance (HMA) – project-level mitigation funding data
- National Flood Insurance Program (NFIP) – claims and policy data
- U.S. Census Bureau American Community Survey (ACS) – demographic and socioeconomic variables
- FEMA National Flood Hazard Layer (NFHL) and Vermont river corridors – spatial flood exposure proxies
- Vermont town boundaries – base geography for aggregation

### Data Processing and Integration

#### Spatial Data
- All spatial datasets were standardized to an equal-area coordinate system (EPSG:5070) for accurate area calculations, then converted to WGS84 (EPSG:4326) for web mapping.
- Flood exposure was estimated by calculating the percent of each town’s land area within:
    - FEMA high-risk flood zones (NFHL)
    - State-defined river corridors
- NFHL coverage varies across the state; a coverage flag was included to account for incomplete mapping.

#### NRI Aggregation
- FEMA NRI data is available at the census tract level and was spatially intersected with town boundaries.
- Tract-level values were allocated to towns using area-weighted proportions.
- Sliver overlaps (<1%) were removed and weights renormalized.
- Aggregated metrics include:
    - Expected annual loss (EAL)
    - Population, building value, and agricultural value
    - Risk, vulnerability (SOVI), and resilience indices

#### ACS Socioeconomic Data
- Multiple ACS tables were cleaned and merged using GEOID identifiers.
- Key indicators were calculated following Census guidance, including:
    - Percent below poverty line
    - Percent elderly
    - Percent without vehicle access
- Margins of error (MOE) were retained and propagated where appropriate.

#### FEMA HMA Funding Data
- Project-level funding was:
    - Inflation-adjusted to 2025 dollars using CPI data (FRED)
    - Filtered to flood-related mitigation projects
- Projects were assigned to towns using:
    - Regex parsing
    - Manual mapping
    - Fuzzy matching for ambiguous cases
- Funding was aggregated to the town level, including:
    - Total funding
    - Funding per capita and per housing unit (log-transformed)
    - Funding by time period (pre-2011, 2011–2022, 2023+)

#### NFIP Claims and Policies
- Claims and policies were cleaned and matched to towns.
- Claims were inflation-adjusted and aggregated by town and period.
- Insurance penetration rates were calculated using active policy counts.

#### Final Dataset
- All datasets were merged at the town level using GEOID and town name.
- Consistency checks ensured alignment across population and housing variables.
- The final dataset includes all Vermont towns, including those with zero funding.

### Construction of the Need Index

A composite need index was developed to estimate relative flood mitigation need across towns.

#### Components
- Risk (Exposure):
    - Primary measure: Expected Annual Loss (EAL) from FEMA NRI
- Vulnerability (Socioeconomic):
    - Percent below poverty
    - Percent elderly
    - Percent without vehicle access

#### Method
- Variables were normalized using both:
    - Z-score standardization
    - Rank-based scaling
- Risk and vulnerability components were equally weighted (50/50) and summed.

#### Rationale
- EAL was selected as the primary risk variable due to its ability to capture multi-dimensional loss (buildings, agriculture, population).
- A parsimonious set of vulnerability variables was chosen to balance interpretability and signal strength.

### Model Evaluation and Validation

#### Robustness Checks
- Need indices were highly consistent across normalization methods
    - Spearman correlation ≈ 0.91–1.00
- Rankings were stable, with only modest variation at the extremes.

#### Sensitivity Analysis  
Two approaches were used:
- Leave-One-Variable-Out (LOVO):  
Tested how removing each variable affected rankings and underfunded town identification.
- Weight Variation:  
Tested alternative weightings (e.g., 70/30, 30/70 risk vs. vulnerability)

Key result:
- The model is robust to weighting choices
- The choice of risk variable (EAL vs. exposure) is the most consequential decision

#### Model Comparison  
Multiple specifications were tested, including:
- Exposure-based models (river corridors, NFHL)
- EAL-based models
- Per capita risk models
- FEMA NRI composite indices

Finding:
- EAL-based models are more stable and policy-relevant than simple exposure measures
- Adding more variables provides limited additional explanatory power (parsimony preferred)

### Funding Alignment Analysis

#### Gap Index  
To evaluate allocation effectiveness:
- Gap = Funding − Need

Interpretation:
- Negative values → underfunded relative to need
- Positive values → overfunded relative to need

The gap index shows:
- Moderate negative correlation with need (~ -0.25 to -0.45), indicating it captures allocation mismatch, not just need.

#### Correlation Analysis
- Need vs. funding: weak correlation (~0.10–0.30)
- Claims vs. funding: stronger correlation (~0.55)

Interpretation:  
- Funding aligns more with past damage (claims) than with forward-looking need.

#### Regression Analysis
- Logistic regression (funding access):
    - AUC ≈ 0.6–0.8 → moderate ability to predict which towns receive funding
- OLS regression (funding amount):
    - R² ≈ 0 → near-zero explanatory power

Interpretation:
- Structural variables weakly explain who gets funding
- They do not explain how much funding is allocated

### Spatial Analysis
- Moran’s I indicates significant spatial clustering of need
- Choropleth maps confirm geographic consistency of risk patterns
- Funding does not exhibit the same spatial alignment

### Quadrant Analysis

Towns were categorized based on need and funding:
- Zero funding
- Underfunded (high need, low funding)
- Aligned
- Overfunded
- Low priority (low need, low funding)

Key observations:
- ~52% of towns received zero funding
- High-need towns are disproportionately represented among underfunded and zero-funded groups
- Distribution across quadrants is consistent across model specifications, though specific towns vary

### Key Limitations
- NFHL flood mapping is incomplete across Vermont
- NFIP participation is extremely low (~1%), limiting claims as a comprehensive risk proxy
- Town-level aggregation may obscure within-town variation
- Funding data reflects approved projects, not unmet demand or unsuccessful applications

### Summary
- The need index is methodologically robust and stable across specifications
- Funding is weakly aligned with structural need, but more strongly aligned with past damages
- Results suggest a reactive funding system, rather than a proactive, risk-based allocation model
- The framework reliably identifies systemic patterns, though precise rankings of individual towns should be interpreted with caution