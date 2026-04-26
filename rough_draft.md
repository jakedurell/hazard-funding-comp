# Floodlines
### Insert witty subtitle

May 2026
Bryan Johns

#### Link to dashboard "Explore the data"

## Hook - tension, curiosity

Does flood mitigation funding actually mitigate funding? This Vermont expat, schooled in environmental policy and spatial data analysis, set out to answer that question.

Nestled within picturesque mountainous terrain, the towns, villages, and hamlets of Vermont were settled along river beds, taking advantage of coursing waterways for saw- and gristmills, easy transportation, waste disposal, and the fertile soil of floodplains for agriculture. Humans development, from removing wetlands to damming and straightening the rivers, has increased the risk of flash flooding. The settlement of much of the state’s lower income population by river beds increases vulnerability. Famously, the state flooded back in 1927, during the Coolidge administration, and repairs stretched into the Depression.

In recent memory, the state rebounded from the devastating effects of Hurricane Irene in 2011, which the population’s resilient spirit proudly displayed in the fundraising “Vermont Strong” front license plates. But another devastating series of flash flooding hit in 2023, and has prompted a more somber spirit of recovery. The reality of climate change-fueled devastating storms is sinking in across the state, and long-term adaptation begins, in an increasingly resource-constrained insecure world.

Considering the scale of recent disasters, the need to effectively target flood mitigation efforts is obvious. One would assume that flood funding matches need but, as this analysis found out, it doesn’t. It matches… something else.

## What was built

Nerds - please see the Technical Methodology Appendix for details if you’re curious.

In order to track need, we (the royal we) first constructed an index of need. Lacking the resources to measure the state’s actual properties at risk (half the state has yet to be mapped for the FEMA National Flood Hazard Layer), we tried a number of quick-and-dirty proxies to build a composite index of risk, vulnerability, and socioeconomic capacity.
Risk was approximated a number of ways, included land exposure based on the FEMA NFHL and state river corridors, and past damage claims from the woefully undersubscribed NFIP (~1% of the state participates in the NFIP, despite 90% of towns being eligible). We ended up using Expected Annual Loss from Inland Flooding, extracted from FEMA’s National Risk Index, a balance of building, agricultural, and human loss.

Inspired by the CDC’s Social Vulnerability Index (SOVI), socioeconomic resilience or precarity was estimated using a variety of variables from the Census Bureau’s American Community Survey. Final variables selected were the percent below the poverty line, percent elderly, and access to a vehicle.

Risk and socioeconomic variables were equally weighted and summed to create a composite need index. 

The need index was stress-tested for effectiveness, dropping and exchanging variables, and adjusting the weights. Although town rankings varied somewhat, results were directionally consistent, indicating index robustness. It was further checked against the FEMA National Risk Index, a similar index of need, and found to be broadly consistent.
Funding includes only projects funded by FEMA’s Hazard Mitigation Assistance Program (mostly acquisition and buyout projects), the principal source of funding for disaster response and recovery.

The need index was subtracted from funding to map out exactly how effectively funding was allocated.

## Funding doesn't track need

Funding only loosely correlates with need. It's not mitigatory. _It tracks something else_

## Who's missed?

First, half the state has received zero HMA funding. These towns fall across the entire spectrum of the need index, and vary widely in terms of population size, risk, and socioeconomic vulnerability.

Describe some towns from each quadrant - one or two from each. Definitely include Johnson as a case study. Maybe a Chittenden County one. A small town. Dunno. Gotta look.

Towns not funded. HIgh need towns more likely to be underfunded. Byzantine application process. Understaffed small towns. etc.

And many towns get zero funding at all.

[Quadrant plot] - [Map of state] - color coded to match

So what explains these disparate results?

## Past damage - reactive vs proactive

Of all the inputs to the need index, the only thing that significantly boosted the ability to predict funding allocation was insurance claims. Perhaps unsurprisingly, mitigation funding correlates to past damage claims.

Funding appears more aligned with past damages than future needs. It’s reactive, not proactive.

[NFIP plot?]

## Discussion / Implications

Funding appears, if anything, structured around past damages, and other things unaccounted for in the data.

These conclusions match similar results found in analyzing disaster response and recovery. FEMA HMA funding faces several access barriers. A Byzantine application process faces towns, and often the person(s) responsible for applying are overworked, quite possibly volunteers. And getting the technical support necessary to plan a mitigation project may be inaccessible. Another barrier is the match - HMA only funds 75% of the project. While the state of Vermont has stepped in to help provide the match, not every town can afford it.

And just because funding more closely matches past damages, that doesn't mean funding is wrong, but it may be solving a different problem.

## Personal Note?

VT childhood, interest in data / policy / GIS

## Closing / CTA

The need index can help identify underserved communities in need of mitigation funding. More flooding is coming; it’s only a matter of time.

Moreover, this can inspire a conversation about the future, one that Vermont is actively facing. We may need to rethink how we define 'need' and mitigation funding.

[Add link to dashboard. Again.]

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