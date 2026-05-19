# Floodlines: The Geography of Institutional Memory

How the way institutions measure risk determines who gets protection — and why prior disaster experience often trumps future vulnerability.

---

## 1. Opening vignette (short)

On a narrow summer morning the Walloomsac runs low and slow through downtown Bennington, dipping past old mills and the modest houses that line its banks. The river knows the town in a way maps do not: every heavy season it finds the same low places, the same culverts, the same basements. By multiple flood‑risk measures Bennington sits high on exposure lists. Yet in the ledger of federal mitigation — the Hazard Mitigation Assistance grants meant to break the cycle — Bennington reads zero.

A few hundred miles away on Lake Memphremagog, Newport City tells a similar story from a different angle: high vulnerability driven by concentrated poverty and an aging population, significant flood exposure, and likewise no record of HMA project funding. Bennington and Newport recur in this analysis not as full case studies but as anchor points — familiar places that help make the statewide pattern concrete.

This is a short account of a simple discovery: when you stack independent measures of future flood risk and social vulnerability against the roll of federal mitigation dollars, a surprising pattern appears. The system that distributes mitigation money does a better job of remembering where disasters have already happened than of anticipating where future damage and social harm are most likely. The consequence is predictable: towns that have been through the cycle are more likely to be resourced; those that have not are less likely to be prepared.

This piece is also a prototype. It uses a deliberately lightweight composite model to ask a policy question that matters far beyond Vermont: how much precision do policymakers need before action becomes possible? The short answer, here, is not as much as you might think. Even relatively simple models can expose structural patterns that warrant attention.

---

## 2. The core question

Why do some towns receive mitigation funding and others do not? At first glance the question looks technical: why is this grant allocation not a neat function of exposure or expected loss? But the better question is institutional: how do the choices we make about measurement, institutional incentives, and program rules shape the geography of protection?

Two forces sit at the center of that question. The first is measurement: how we define and quantify “need” — the mix of physical risk and social vulnerability that should guide mitigation priorities. The second is institutional structure: the set of laws, practices, funding cycles, and administrative capacities that determine who can apply for money, who can comply with grant requirements, and who is noticed by the agencies that distribute funds.

Measurement matters because it creates the categories that programs respond to. A town labeled “high need” on the basis of one index may be invisible under another. Institutional structure matters because programs are not neutral mechanisms that automatically target the highest‑need places; they are bureaucracies with histories, local relationships, and procedural gates. Together, measurement and structure produce path‑dependent patterns: the towns that learn how to navigate mitigation programs and that have prior disaster experience keep showing up in grant awards, while other high‑need places do not.

Framed this way, the problem is not that a dataset is wrong or that one model is better. The problem is that measurement is itself a political and organizational act, and that act privileges certain histories and capacities over other potential futures.

---

## 3. The floods and the institutional system

Vermont has been reminded twice, loudly, in little more than a decade that its rivers can reorganize lives. In August 2011 Hurricane Irene stalled into the state and produced widespread damage: washed bridges, cleaved roads, towns underwater. The literal image of that summer — roads turned into rivers — remains a touchstone in Vermont memory. Twelve years later, in July 2023, intense rainfall again produced catastrophic flooding across multiple watersheds. Montpelier and Barre both flooded, towns and infrastructure were damaged, and the tally of losses climbed into the hundreds of millions.

Each federally declared disaster triggers a cascade of responses: emergency response dollars for repair and debris removal; longer‑term recovery programs; and a quieter, slower turn toward mitigation through FEMA’s Hazard Mitigation Assistance programs. HMA is designed to do what disaster relief does not: pay to prevent the next event from doing the same damage. It funds acquisitions and buyouts, elevating or flood‑proofing public infrastructure, culvert replacements, and other capital investments.

But HMA is not an automatic stabilizer. It is administered through a patchwork of program rules that presuppose administrative capacity: applications, benefit‑cost analyses, environmental and historic preservation reviews, cost shares and local matches. A town that has been through a disaster–response cycle often has two advantages. First, a recent disaster creates the political, financial, and technical momentum for mitigation: the state and federal actors are focused, money is available, and projects can be scoped from an acute unmet‑need baseline. Second, the relationships and institutional memory developed during recovery — staff who learned the forms, consultants who know the engineers, state hazard officers who know local plans — lower the barrier to re‑entry.

Those advantages compound. Towns that secured HMA projects after Irene were materially more likely to secure projects after 2023. In practice, the system amplifies its winners: prior disaster experience, and the administrative capacity it produces, translates into future eligibility.

Two program features bear emphasis. First, the dominant form of spending in Vermont has been acquisition and buyouts: permanent removal of properties from floodplains. Buyouts are effective, but they are capital‑intensive, politically fraught, and often contingent on a pre‑existing disaster narrative. Second, the link between federal mitigation and disaster declarations means the program is biased toward places that have experienced big, declared events — not necessarily toward places with the greatest modeled future harm.

The interaction of hydrology, settlement patterns, and administrative practice is what I mean by “institutional geography”: the uneven landscape of capacity, history, and rules that determines who can access protection. This is a systems problem as much as an engineering one.

---

## 4. The model: need = risk + vulnerability (prototype)

To test whether mitigation dollars align with future need, I built a simple, transparent prototype: a need index that combines two components. The first is risk — modeled exposure, proxied by expected annual loss from flood hazard products (EAL) and a FEMA composite (NRI) in alternate specifications. The second is vulnerability — a compact socioeconomic triad drawn from the American Community Survey: percent below poverty, percent elderly, and percent of households without vehicle access. The logic is straightforward: damage matters, but so does the community’s ability to absorb and recover from damage.

Operationally the model is intentionally simple by design. Variables are rank‑normalized so towns are compared relative to their statewide peers (a bounded, interpretable 0–1 scale). Risk and vulnerability are combined with equal weight into a need score. I tested three model specifications (asset‑weighted EAL, per‑capita EAL, and the FEMA NRI) to ensure the patterns were not artifacts of a single index.

Why rank normalization? Two reasons matter for policy thinking. First, Vermont data are skewed: a few towns concentrate EAL and funding into the millions, while many towns are small and rural. Percentile ranking makes results communicable — a 0.85 need score is easy to explain. Second, the rank approach reduces the influence of extreme outliers while preserving relative order; the substantive story about which towns are relatively more in need is robust across modest variations in normalization.

The funding side of the calculation is deliberate, too. Funding is measured per capita and log‑transformed to reduce skew; that transformed measure is then rank‑normalized so funding and need live on comparable scales. The gap index is simply:

> gap = need − normalized funding

Positive values mean underfunded relative to modeled need; negative values mean overfunded. To make gap magnitudes intuitive we scale them by the mean absolute gap: a gap_rel value of 1.0 means a town’s gap is about the typical gap magnitude in the state.

A few methodological qualifications, briefly. The model is not a forecasting engine; it is a ranking instrument intended to reveal structural patterns. It does not, and cannot in this iteration, capture every nuance — local projects, corridor‑level hydrology, or political negotiations. But the purpose is not perfect prediction; it is signal detection. Even these simple composites consistently identify clusters of towns that are both highly exposed and socioeconomically vulnerable.

This prototype was built with policy relevance in mind: it is readable, replicable, and easy to explain to practitioners. That matters because one of the practical questions of adaptation is not whether a model can be perfectly calibrated, but whether it can be precise enough to mobilize action.

---

## 5. What the data shows

Viewed on a map, the need index produces a familiar geography: high‑need towns cluster in valley corridors where exposure and built concentration meet socioeconomic vulnerability. The Connecticut River corridor, the Winooski and its tributaries in central Vermont, the Battenkill and Walloomsac in the southwest, and pockets of the Northeast Kingdom all light up as places where physical exposure and social risk overlap. Those clusters are not surprises to Vermonters; they are the geography of settlement and infrastructure.

Compare that need map to a map of HMA funding and the divergence becomes clear. Towns with large sums of obligated mitigation dollars frequently line up with prior disaster experience and with municipalities that have already navigated the grant system. Many towns flagged as high need by the composite — including recurring anchors like Bennington and Newport — show little or no HMA funding in the historical record.

Scatterplots make the relationship quantitative. Plot need rank (x) against funding rank (y): if mitigation followed modeled need closely, the cloud would slope upward toward the diagonal. Instead, the cloud is relatively flat. Across model specifications the correlation between need and funding ranks sits roughly between 0.10 and 0.30 — a weak relationship. By contrast, the correlation between past NFIP claims paid and HMA funding is markedly stronger, approximately 0.55: past claims are a far better single predictor of whether a town receives mitigation grants than a forward‑looking need index.

Quadrant analysis reinforces the interpretation. When the scatter is split by median lines you get five useful categories: underfunded (high need, low funding), aligned (high need, high funding), overfunded (low need, high funding), low priority (low need, low funding), and zero funded (no funding). The zero‑funded category is especially revealing: roughly half of Vermont’s towns have received no HMA funding at all, and a disproportionate share of high‑need towns fall into that bucket. Of the towns in the upper tercile of need, a notable subset has never been awarded mitigation funds.

These patterns are not concentrated in a single region or economic type. They cut across the state: rural towns with limited administrative capacity, post‑industrial mill towns with concentrated vulnerability, and some larger towns with complex local politics can all appear under‑resourced by the model’s metric. The common thread is not geography per se — it is institutional geography: a history of engagement with disaster response, local capacity to apply and manage projects, and the existence of a precedent that a community can point to when asking for mitigation assistance.

The maps and plots do not prove causation. But together they point to a system where memory — the record of prior disasters and the institutional learning that follows — shapes resource flows more than the modeled distribution of future harm.

---

## 6. Why the mismatch exists

Three mechanisms explain much of the divergence between modeled need and allocated mitigation funding: disaster‑linked eligibility, administrative capacity, and path dependence.

First, eligibility and timing. Major mitigation dollars tend to appear in the wake of declared disasters. Disaster declarations lower political and procedural barriers: they focus attention, unlock emergency resources, and create opportunities for mitigation projects that are visible and fundable. If a town has not experienced a declared event that attracts federal attention, it is unlikely to be first in line when mitigation funds are parceled out.

Second, administrative capacity matters. HMA grants require technical applications, benefit‑cost analyses, interagency coordination, and often a local match. A small town whose emergency management is a part‑time official or volunteer board lacks the staff bandwidth to develop compliant, competitive proposals. Conversely, towns that have gone through the process develop institutional know‑how: staff, consultants, templates, and relationships with state hazard mitigation officers. That know‑how reduces transaction costs and increases the likelihood of subsequent awards.

Third, path dependence and network effects: the system accumulates memory. Relationships built during a disaster cycle — between municipal officials, engineers, consulting firms, and state and federal staff — persist. That persistence reinforces the distribution of resources. Towns that received buyouts and other projects after Irene were more likely to find pathways to funding after 2023. The system rewards prior engagement, which in turn creates more engagement.

There are other, subtler forces at work. Benefit‑cost frameworks tend to favor projects where dollarized benefits are easy to demonstrate; that can privilege densely built areas over dispersed rural communities even when human vulnerability is higher in the latter. Political visibility and local advocacy matter: towns that can tell a compelling, documented story about past loss are advantaged in grant competitions. Insurance dynamics create a further bias: NFIP claims — a backward‑looking indicator — are an observable signal that correlates with funding, even where claims undercount the real loss because participation is low.

Put together, these mechanisms create a system that is reactive rather than anticipatory. It is not necessarily unjust by intent; it is an emergent property of program design and capacity distribution. But from the standpoint of reducing future harm equitably, the pattern is troubling: those without declared disasters, without prior awards, and without administrative bandwidth are also often those most vulnerable when the next flood comes.

---

## 7. What happens next

Two policy shifts are poised to change the terrain, but neither is a silver bullet. First, flood maps are being redrawn in many areas to reflect updated hydrology and increased flood risk. New maps will change insurance requirements, regulatory baselines, and, potentially, the canvas of grant eligibility. But map changes are slow to implement and politically contested; they can improve the technical alignment of programs only if policymakers and agencies use the new information in funding rules.

Second, federal mitigation programs and budgets are evolving. Programs that reduce local match requirements, provide dedicated technical assistance for smaller communities, or prioritize social vulnerability can help address the capacity gap. State efforts to pre‑position mitigation funds, offer match assistance, or create rapid‑response technical teams can also reduce the friction small towns face. Those are the levers that matter.

Yet the deeper challenge is institutional: how to take a system that remembers the past and teach it to see the future. That requires shifting incentives, lowering transaction costs for small towns, and embedding forward‑looking risk measures into the decision architecture of mitigation programs. It also means building and funding local capacity so that towns can prepare strong project proposals before disaster arrives.

One practical implication flows from the prototype’s center: measurements are not neutral. A simple ranking that flags high‑need towns can be a pragmatic policy tool if paired with mechanisms — technical assistance, set‑asides, or simplified application tracks — that reduce entry barriers. Policymakers do not need perfect models to act; they need actionable indicators joined to concrete administrative remedies.

---

## 8. Ending (short, understated, forward‑looking)

Bennington and Newport recur here as reminders that flood risk and social risk do not always meet the public dollars meant to prevent harm. The pattern the data reveal is not destiny: it is a product of choices about measurement, process, and investment. We can change those choices.

This analysis is a prototype — a lightweight composite meant to clarify the shape of a policy problem, not to replace detailed local planning. The hope is simple: by making institutional geography visible, we open the door to reforms that let mitigation dollars reach places before they become emergencies. That shift from remembering the past to anticipating the future is the practical heart of resilience.

---

*Data and methods: prototype composite models combine FEMA EAL and NRI variants with a small vulnerability triad (poverty, elderly share, no‑vehicle households). Funding is measured per capita, log‑transformed, and rank‑normalized. The interactive dashboard and full technical appendix are available in the project repository.*
