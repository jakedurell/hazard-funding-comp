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

Margin of error (MOE) for derived percentages is calculated using the [ACS-recommended formula for ratios](https://www2.census.gov/programs-surveys/acs/tech_docs/accuracy/2024_ACS_Accuracy_Document_Worked_Examples.pdf), combining numerator and denominator MOEs in quadrature:

> `MOE = 100 * sqrt((numerator_moe / denominator)^2 + ((numerator * denominator_moe) / denominator^2)^2)`

### FEMA Project Codes

FEMA project types were classified using the official [FEMA Mitigation eGrants Guide to Eligible Activities and Codes](https://www.fema.gov/sites/default/files/2020-08/fema_mt-egrants-guide-to-eligible-activities-and-codes_job_aid_March_2018.pdf).

