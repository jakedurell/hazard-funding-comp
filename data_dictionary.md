# Data Dictionary

## Town Flood Risk Data Dictionary

- **GEOID**: Unique 10-digit Census identifier for the town (FIPS code), a concatenation of the state (50), county (3 digits), and place (5 digits) codes.  
- **NAME**: Short name of the town.  
- **NAMELSAD**: Full name and legal/statistical area description of the town (e.g., “Eden town”).  
- **ALAND**: Land area of the town from Census data (square meters).  
- **AWATER**: Water area of the town from Census data (square meters).  
- **town_area_sqm**: Land area of the town calculated from the projected geometry (EPSG:5070) (square meters).  
- **pct_river_corridor**: Percentage of the town’s area within the state-defined river corridor polygons (percent %).  
- **pct_high_risk_NFHL**: Percentage of the town’s area within FEMA high-risk flood zones (AE, A, AH, AO) (percent %).  

## ACS Socioeconomic Summary Data Dictionary

- **GEOID**: Unique 10-digit Census identifier for the town (FIPS code), a concatenation of the state (50), county (3 digits), and place (5 digits) codes.  
- **town_name**: Name of the town, extracted from the ACS “Geographic Area Name” field.  
- **median_income**: Median household income in the past 12 months (in 2024 inflation-adjusted dollars).  
- **median_income_moe**: Margin of error for median household income (dollars).  
- **total_population**: Total number of people residing in the town.  
- **total_population_moe**: Margin of error for total population (number of persons).  
- **percent_elderly**: Percentage of the total population age 65 and over.  
- **percent_elderly_moe**: Margin of error for percent elderly (percentage points).  
- **median_year_house_built**: Median year structure was built.  
- **median_year_house_built_moe**: Margin of error for median year structure built (years).  
- **pct_no_vehicle**: Percentage of occupied households with no vehicle available.  
- **pct_no_vehicle_moe**: Margin of error for percent of households with no vehicle (percentage points).  
- **occupied_housing_units**: Total number of occupied housing units in the town.  
- **occupied_housing_units_moe**: Margin of error for occupied housing units (number of units).  
- **pct_renter_occupied**: Percentage of occupied housing units that are renter-occupied.  
- **pct_renter_occupied_moe**: Margin of error for percent renter-occupied (percentage points).  
- **pct_bachelors_or_higher**: Percentage of the population age 25 and over with a bachelor’s degree or higher.  
- **pct_bachelors_or_higher_moe**: Margin of error for percent with bachelor’s degree or higher (percentage points).  
- **pct_below_poverty**: Percentage of the population for whom poverty status is determined that is below the poverty line.  
- **pct_below_poverty_moe**: Margin of error for percent below poverty (percentage points).  
- **percent_with_disability**: Percentage of the civilian noninstitutionalized population with a disability.  
- **percent_with_disability_moe**: Margin of error for percent with disability (percentage points).  
- **pct_mobile_home**: Percentage of all housing units that are mobile homes.  
- **pct_mobile_home_moe**: Margin of error for percent mobile home (percentage points).  

## Town-Level FEMA Funding Summary Data Dictionary

- **GEOID**: Unique 10-digit Census identifier for the town (FIPS code), a concatenation of the state (50), county (3 digits), and place (5 digits) codes.
- **town_name**: Name of the town, standardized for merging across datasets.
- **total_population**: Total number of people residing in the town (from ACS).
- **occupied_housing_units**: Total number of occupied housing units in the town (from ACS).

### FEMA Funding Variables (all dollar amounts are cumulative for 1996–2024, unless otherwise noted):

- **funding_acquisition_buyouts**: Total FEMA funding obligated for property acquisition and buyout projects (USD).
- **funding_admin**: Total FEMA funding obligated for administrative costs (USD).
- **funding_ecosystem_restoration**: Total FEMA funding obligated for ecosystem restoration and natural infrastructure projects (USD).
- **funding_equipment**: Total FEMA funding obligated for equipment purchases (USD).
- **funding_flood_control**: Total FEMA funding obligated for flood control structures (e.g., levees, dams) (USD).
- **funding_infrastructure_protection**: Total FEMA funding obligated for protection of critical infrastructure (e.g., utilities, public buildings) (USD).
- **funding_infrastructure_stormwater**: Total FEMA funding obligated for stormwater management and drainage infrastructure (USD).
- **funding_other**: Total FEMA funding obligated for projects not classified in other categories (USD).
- **funding_planning**: Total FEMA funding obligated for planning, studies, and technical assistance (USD).
- **funding_structure_protection**: Total FEMA funding obligated for structural protection and retrofitting of buildings (USD).

- **federalShareObligated**: Total FEMA federal share obligated to the town across all eligible projects (USD).
- **numberOfFinalProperties**: 	Actual number of properties mitigated by the project as provided by project closeout activities.
- **numberOfProperties**: Proposed number of properties to be mitigated by the project. Note, a zero values means the project does not apply mitigation directly to structures.

- **pre_2011**: FEMA obligated funding for projects before 2011 (USD).  
- **2011_2022**: FEMA obligated funding for projects from 2011 to 2022, including funding awarded in response to Hurricane Irene flooding in 2011 (USD).  
- **2023_plus**: FEMA obligated funding for projects in 2023 or later, including funding awarded in response to flood events from 2023 (USD).  

### Derived Funding Metrics

- **cost_per_property**: Average FEMA funding per property included in funded projects (USD/property).
- **cost_per_final_property**: Average FEMA funding per property with completed mitigation actions (USD/property).

### Funding Category Shares

- **share_acquisition_buyouts**: Proportion of total obligated funding allocated to acquisition/buyout projects (0–1).
- **share_admin**: Proportion of total obligated funding allocated to administrative costs (0–1).
- **share_ecosystem_restoration**: Proportion of total obligated funding allocated to ecosystem restoration (0–1).
- **share_equipment**: Proportion of total obligated funding allocated to equipment (0–1).
- **share_flood_control**: Proportion of total obligated funding allocated to flood control structures (0–1).
- **share_infrastructure_protection**: Proportion of total obligated funding allocated to infrastructure protection (0–1).
- **share_infrastructure_stormwater**: Proportion of total obligated funding allocated to stormwater management (0–1).
- **share_other**: Proportion of total obligated funding allocated to other/uncategorized projects (0–1).
- **share_planning**: Proportion of total obligated funding allocated to planning and studies (0–1).
- **share_structure_protection**: Proportion of total obligated funding allocated to structural protection/retrofitting (0–1).

### Normalized Funding Metrics

- **funding_per_capita**: Total FEMA obligated funding divided by total population (USD/person).
- **log_funding_per_capita**: Natural log of (funding_per_capita + 1), to reduce skewness and allow for zero values.
- **funding_per_occupied_unit**: Total FEMA obligated funding divided by number of occupied housing units (USD/unit).
- **log_funding_per_occupied_unit**: Natural log of (funding_per_occupied_unit + 1), to reduce skewness and allow for zero values.

### Binary Funding Flag

- **has_funding**: Boolean flag indicating whether the town received any FEMA mitigation funding (`True` if funding_per_capita > 0, else `False`).

## NFIP Claims Summary Data Dictionary

- **GEOID**: Unique 10-digit Census identifier for the town (FIPS code), a concatenation of the state (50), county (3 digits), and place (5 digits) codes.
- **town_name**: Name of the town, standardized for merging across datasets.
- **total_population**: Total number of people residing in the town (from ACS).
- **occupied_housing_units**: Total number of occupied housing units in the town (from ACS).

### NFIP Claims Variables

- **nfip_claims**: Total number of NFIP insurance claims filed in the town (count, all years).
- **total_nfip_claims_paid**: Total dollar amount paid out for NFIP insurance claims in the town (USD, all years).

### Claims by Period (all dollar amounts are cumulative for the period):

- **pre_2011_nfip_claims**: Total dollar amount paid for NFIP claims with loss dates before 2011 (USD).
- **2011_2022_nfip_claims**: Total dollar amount paid for NFIP claims with loss dates from 2011 to 2022 (USD).
- **2023_plus_nfip_claims**: Total dollar amount paid for NFIP claims with loss dates in 2023 or later (USD).

### Claim Counts by Period

- **pre_2011_nfip_claims_count**: Number of NFIP claims with loss dates before 2011.
- **2011_2022_nfip_claims_count**: Number of NFIP claims with loss dates from 2011 to 2022.
- **2023_plus_nfip_claims_count**: Number of NFIP claims with loss dates in 2023 or later.

### Normalized Claims Metrics

- **claims_paid_per_capita**: Total dollar amount of NFIP claims paid divided by total population (USD/person).
- **claims_paid_per_housing_unit**: Total dollar amount of NFIP claims paid divided by number of occupied housing units (USD/unit).

### Policy Counts by Period

- **irene_policies**: Number of active NFIP insurance policies in force in the town on August 28, 2011 (the date of Hurricane Irene).
- **flood2023_policies**: Number of active NFIP insurance policies in force in the town on July 10, 2023 (the date of the 2023 Vermont flood event).
- **today_policies**: Number of active NFIP insurance policies in force in the town as of the most recent data extraction date.
- **current_insurance_penetration**: Proportion of occupied housing units in the town with an active NFIP insurance policy as of the most recent data extraction date (today_policies divided by occupied_housing_units).

# Notes:

### FEMA NFHL Flood Zone Definitions:

- **Zone AE**: Areas subject to inundation by the 1% annual chance flood (100-year flood); base flood elevations (BFEs) determined.  
- **Zone A**: Areas subject to inundation by the 1% annual chance flood; no BFEs determined.  
- **Zone AH**: Areas of 1% annual chance shallow flooding (usually ponding, generally less than 3 feet deep); BFEs determined.  
- **Zone AO**: Areas of 1% annual chance shallow flooding (usually sheet flow on sloping terrain); average depths determined (usually 1–3 feet).  

### ACS Populations

- **B19013 (Median Household Income)**: Universe = all households  
- **B01001 (Sex by Age / Elderly Population)**: Universe = total population  
- **B25035 (Median Year Structure Built)**: Universe = all housing units  
- **B08201 (Vehicle)**: Universe = occupied housing units  
- **B25003 (Renter-Occupied)**: Universe = occupied housing units  
- **B15003 (Education Level)**: Universe = population 25 years and over  
- **B17001 (Poverty Level)**: Universe = population for whom poverty status is determined (excludes group quarters, some children, etc.)  
- **B18101 (Disability Status)**: Universe = civilian noninstitutionalized population  
- **B25024 (Units in Structure / Mobile Homes)**: Universe = all housing units  

### ACS Margin of Error Calculations

Margin of error (MOE) for derived percentages is calculated using the [ACS-recommended formula for ratios](https://www2.census.gov/programs-surveys/acs/tech_docs/accuracy/2024_ACS_Accuracy_Document_Worked_Examples.pdf), combining numerator and denominator MOEs in quadrature:

> `MOE = 100 * sqrt((numerator_moe / denominator)^2 + ((numerator * denominator_moe) / denominator^2)^2)`

### FEMA Project Codes

FEMA project types were categorized using the official [FEMA Mitigation eGrants Guide to Eligible Activities and Codes](https://www.fema.gov/sites/default/files/2020-08/fema_mt-egrants-guide-to-eligible-activities-and-codes_job_aid_March_2018.pdf).

