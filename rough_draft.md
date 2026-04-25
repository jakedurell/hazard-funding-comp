# Floodlines
### Insert witty subtitle

May 2026
Bryan Johns

#### Link to dashboard "Explore the data"

### Hook - tension, curiosity

Does flood mitigation funding actually mitigate funding? This Vermont expat, schooled in environmental policy and spatial data analysis, set out to answer that question.

Nestled within picturesque mountainous terrain, the towns, villages, and hamlets of Vermont were settled along river beds, taking advantage of coursing waterways for saw- and gristmills, easy transportation, waste disposal, and the fertile soil of floodplains for agriculture. Humans development, from removing wetlands to damming and straightening the rivers, has increased the risk of flash flooding. The settlement of much of the state’s lower income population by river beds increases vulnerability. Famously, the state flooded back in 1927, during the Coolidge administration, and repairs stretched into the Depression.

In recent memory, the state rebounded from the devastating effects of Hurricane Irene in 2011, which the population’s resilient spirit proudly displayed in the fundraising “Vermont Strong” front license plates. But another devastating series of flash flooding hit in 2023, and has prompted a more somber spirit of recovery. The reality of climate change-fueled devastating storms is sinking in across the state, and long-term adaptation begins, in an increasingly resource-constrained insecure world.

Considering the scale of recent disasters, the need to effectively target flood mitigation efforts is obvious. One would assume that flood funding matches need but, as this analysis found out, it doesn’t. It matches… something else.

### What was built

Nerds - please see the Technical Methodology Appendix for details if you’re curious.

In order to track need, we (the royal we) first constructed an index of need. Lacking the resources to measure the state’s actual properties at risk (half the state has yet to be mapped for the FEMA National Flood Hazard Layer), we tried a number of quick-and-dirty proxies to build a composite index of risk, vulnerability, and socioeconomic capacity.
Risk was approximated a number of ways, included land exposure based on the FEMA NFHL and state river corridors, and past damage claims from the woefully undersubscribed NFIP (~1% of the state participates in the NFIP, despite 90% of towns being eligible). We ended up using Expected Annual Loss from Inland Flooding, extracted from FEMA’s National Risk Index, a balance of building, agricultural, and human loss.

Inspired by the CDC’s Social Vulnerability Index (SOVI), socioeconomic resilience or precarity was estimated using a variety of variables from the Census Bureau’s American Community Survey. Final variables selected were the percent below the poverty line, percent elderly, and access to a vehicle.

Risk and socioeconomic variables were equally weighted and summed to create a composite need index. 

The need index was stress-tested for effectiveness, dropping and exchanging variables, and adjusting the weights. Although town rankings varied somewhat, results were directionally consistent, indicating index robustness. It was further checked against the FEMA National Risk Index, a similar index of need, and found to be broadly consistent.
Funding includes only projects funded by FEMA’s Hazard Mitigation Assistance Program (mostly acquisition and buyout projects), the principal source of funding for disaster response and recovery.

The need index was subtracted from funding to map out exactly how effectively funding was allocated.

### Funding doesn't track need

Funding only loosely correlates with need. It's not mitigatory. _It tracks something else_

### Who's missed?

First, half the state has received zero HMA funding. These towns fall across the entire spectrum of the need index, and vary widely in terms of population size, risk, and socioeconomic vulnerability.

Describe some towns from each quadrant - one or two from each. Definitely include Johnson as a case study. Maybe a Chittenden County one. A small town. Dunno. Gotta look.

Towns not funded. HIgh need towns more likely to be underfunded. Byzantine application process. Understaffed small towns. etc.

And many towns get zero funding at all.

[Quadrant plot] - [Map of state] - color coded to match

So what explains these disparate results?

### Past damage - reactive vs proactive

Of all the inputs to the need index, the only thing that significantly boosted the ability to predict funding allocation was insurance claims. Perhaps unsurprisingly, mitigation funding correlates to past damage claims.

Funding appears more aligned with past damages than future needs. It’s reactive, not proactive.

[NFIP plot?]

### Discussion / Implications

Funding appears, if anything, structured around past damages, and other things unaccounted for in the data.

These conclusions match similar results found in analyzing disaster response and recovery. FEMA HMA funding faces several access barriers. A Byzantine application process faces towns, and often the person(s) responsible for applying are overworked, quite possibly volunteers. And getting the technical support necessary to plan a mitigation project may be inaccessible. Another barrier is the match - HMA only funds 75% of the project. While the state of Vermont has stepped in to help provide the match, not every town can afford it.

And just because funding more closely matches past damages, that doesn't mean funding is wrong, but it may be solving a different problem.

### Personal Note?

VT childhood, interest in data / policy / GIS

### Closing / CTA

The need index can help identify underserved communities in need of mitigation funding. More flooding is coming; it’s only a matter of time.

Moreover, this can inspire a conversation about the future, one that Vermont is actively facing. We may need to rethink how we define 'need' and mitigation funding.

[Add link to dashboard. Again.]

### Technical Appendix / Methodology

Data sources, index construction, normalization methods, logit, OLS, Moran's I