# Notes

Exposure = normalized % flood area
Socioeconomic = average of standardized vulnerability proxies
Investment = normailzed mitigation per capita

Adaptation Gap = Exposure * Socioeconomic - Investment

#### GIS (physical hazard footprint):

Federal and State map polygons match. Same with FEMA NFHL, but I don't have half of the states. I do have River Corridors for the entire state.

#### ACS variables (socioeconomic proxy vulnerability):

Median income (resilience proxy)  
% elderly (vulnerability proxy)  
Housing age (flood resiliencee)  
Vehicle access (evacuation proxy)  
Renter-occupied (recovery stability proxy)  

% Bachelor's degree or higher (info/institutional access)  
% below poverty line (sub for median income?)  
% disability status (evacuation / recovery proxy)  
% mobile home (vulnerability)  

#### Hazard Funding (public mirigation allocation):

HMGP (Hazard Mitigation Grant Program) (the biggie)  
FMA (Flood Mitigation Assistance)  
BRIC (Building Resilient Infrastructure and Communities)  

#### Model funding alignment

Investment as a function of flood risk and socioeconomic vulnerability
Tells me which towns are under-/overfunded

#### Sensitivity Analysis

Play with weights in the index

#### Thoughts / Ideas

Stress-test exposure (compare NFHL overlap of river corridors)?
Typology instead of ranking (based on exposure and investment)?

Flood risk: % flood zone / town area?
Give equal weight to each (z-scored) ACS variable?
Normalize investment: per capita? per housing unit? per exposed acre?

What do I do with "Statewide" funding? per capita? per housing unit? per exposed acre? exclude altogether?

Track down other sources of funding?



#### Ghost towns

Surprise! Vermont has ghost towns with little or no population (Glastenbury, Lewis, Avery’s Gore, Warner’s Grant, Warren’s Gore, Somerset) and therefore little or no ACS data. 



#### GIS questions

What's the overlap between river corridors and NFHL? How are they calculated / where do they come from? River corridors are about erosion / river movement / channel migration / flooding, NFHL about inundation, so..... some towns have more erosion risk, or a wide buffer, while others have broad floodplains, or detailed federal mapping?

How'd the river corridor data get made?

#### Flood Planning questions

