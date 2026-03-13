## FEMA NFHL Flood Zone Definitions:

- **Zone AE**: Areas subject to inundation by the 1% annual chance flood (100-year flood); base flood elevations (BFEs) determined.  
- **Zone A**: Areas subject to inundation by the 1% annual chance flood; no BFEs determined.  
- **Zone AH**: Areas of 1% annual chance shallow flooding (usually ponding, generally less than 3 feet deep); BFEs determined.  
- **Zone AO**: Areas of 1% annual chance shallow flooding (usually sheet flow on sloping terrain); average depths determined (usually 1–3 feet).  

## Town Flood Risk Data Dictionary

- **GEOID**: Unique 10-digit Census identifier for the town (FIPS code), a concatenation of the state (50), county (3 digits), and place (5 digits) codes.  
- **NAME**: Short name of the town.  
- **NAMELSAD**: Full name and legal/statistical area description of the town (e.g., “Eden town”).  
- **ALAND**: Land area of the town from Census data (square meters).  
- **AWATER**: Water area of the town from Census data (square meters).  
- **town_area_sqm**: Land area of the town calculated from the projected geometry (EPSG:5070) (square meters).  
- **pct_river_corridor**: Percentage of the town’s area within the state-defined river corridor polygons (percent %).  
- **pct_high_risk_NFHL**: Percentage of the town’s area within FEMA high-risk flood zones (AE, A, AH, AO) (percent %).  