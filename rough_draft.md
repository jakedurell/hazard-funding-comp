# Floodlines
### Insert witty subtitle 
(When Disaster Funding Follows the Past, Not the Future)  
(Why Vermont’s Flood Money Misses the Mark)  
(The Mismatch Between Risk and Relief)  
(Where flood funding falls short of risk) 
(Mapping the gap between flood risk and flood funding)   


May 2026  
Bryan Johns

[Link to dashboard "Explore the data"]

## After every flood, money flows

_The assumption is simple: it goes where it’s needed most._

That’s the story we tell ourselves, anyway.

Flood mitigation funding is supposed to reduce future risk. But in Vermont, it seems to follow something more familiar: **past damage**.

That distinction matters. If funding primarily follows where flooding has already occurred, rather than where it is most likely to occur next, some communities may remain exposed.

This project tests a simple idea: **Does mitigation funding actually line up with need?**

## A landscape shaped by water

Vermont’s towns were built along rivers: they powered mills, moved goods, and supported agriculture with nutrient-rich alluvial soil. Over time, wetlands were drained, channels altered, and development pushed into floodplains. The waters have proved to be a tremendous assest, and a growing source of risk.

Flooding isn't new. But its frequency, and the way the state is thinking about it, has changed.

Vermont school children were raised hearing about the catastrophic 1927 floods, a relic of the time before Man had tamed Nature. In 2011 Hurricane Irene swept the state, a one-off crisis that pulled communities together in "Vermont Strong" resiliency.

Then the 2023 floods hit.

This time, the tone shifted. Less resilience narrative, more grim recognition: these floods aren’t rare events anymore. As one VT Digger article put it the following month, _Lamoille County was ranked safest in the nation from climate change. After flood, ‘that doesn’t bode well.’_

The pattern is becoming harder to ignore. This is the new normal.

## Measuring “need”

To make this question testable, I built a simple index of relative need across towns. Nothing fancy. Just a structured way to compare places:

- **Risk**: Expected annual flood loss
- **Vulnerability**: Socioeconomic factors like poverty, age, and access to transportation

It’s a model, not reality. (_All models are wrong, but some are useful._) But it’s consistent, and good enough to see whether funding broadly tracks where risk and vulnerability are highest.

## The result

It doesn't track. At least, not very well. **Funding is only weakly aligned with this measure of need.**

Some high-risk, high-vulnerability towns receive little or no funding. Others receive more than their relative risk might suggest. But one variable _does_ stand out:

**past damage.**

Towns with more insurance claims are significantly more likely to receive mitigation funding.

## So… is that a problem?

At first glance, it looks like one. But it’s not that simple. 

Past damage is often one of the best real-world indicators of risk. Places that have flooded before tend to flood again. And mitigation funding may already be reducing future losses in ways this analysis can’t fully see.

So this isn’t a clean “gotcha.” It’s more of a tension:

**Funding appears to follow experienced risk more than modeled future need.**

Which raises a different question, less about correctness, more about coverage.

## Who gets missed

Even with that caveat, some patterns are hard to ignore:

- Roughly half of Vermont towns receive no mitigation funding
- High-need towns show up disproportionately among the underfunded
- Smaller, more vulnerable places appear less consistently served

Not everywhere that’s at risk is in the system.

## The quiet variable: access

Mitigation funding doesn’t just get magically allocated; it’s applied for. And that process isn’t neutral. It rewards places that have:

- time
- staff
- technical expertise
- and the ability to front matching funds

If you’re a small town with limited capacity, that’s a high bar.

So funding patterns may reflect not just risk, but **who is able to navigate the system in the first place**.

## Reactive vs. proactive

There’s a logic to how things work now. After a flood, the need is visible. Damage is documented. Funding follows.

But that creates a lag. A system designed to prevent damage ends up being driven by damage that has already happened.

## What this means

Flooding in Vermont isn’t a question of _if_. I’s a question of _where next_.

If funding continues to rely heavily on past damage and local capacity, some high-risk communities may remain under-protected—not because they’re low risk, but because they haven’t been hit yet, or can’t access the system as easily.

A more proactive layer, something that looks forward as well as backward, could help close that gap.

## Explore the data

This analysis is interactive—maps, rankings, and town-level breakdowns:

[Add link to dashboard. Again.]

## Final thought

Floods will keep coming.

The question is whether funding shows up before them—or after.

## Technical Methodology Appendix

This analysis evaluates whether flood mitigation funding in Vermont aligns with underlying need. “Need” is treated as a normative construct (what funding should target), while observed funding patterns reflect real-world allocation dynamics.

### Data Sources

- FEMA National Risk Index (expected annual loss, risk indicators)
- FEMA Hazard Mitigation Assistance (project-level funding)
- National Flood Insurance Program (claims data)
- U.S. Census American Community Survey (socioeconomic variables)
- FEMA National Flood Hazard Layer and Vermont river corridors (exposure)
- Vermont town boundaries

### Approach

- Built a composite need index combining risk and vulnerability
- Aggregated all data to the town level
- Compared funding patterns against need and other variables

### Key findings

- Need vs. funding:  weak correlation
- Claims vs. funding:  stronger correlation
- ~50% of towns receive no funding
- High-need towns are disproportionately underfunded

### Limitations

- Incomplete flood mapping coverage
- Low NFIP participation (~1%)
- Town-level aggregation masks within-town variation
- Funding reflects approved projects, not unmet demand