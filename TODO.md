# TODO

## 1. Repository data cleanup (do before porting into Reef Advocate)

**Problem.** `.git` is ~528 MB. Roughly 440 MB of that is data that conventionally
would not be committed, inherited from the upstream Floodlines repo. Untracking
`node_modules` (done, commit `cc852fe`) stopped future churn but **did not shrink
anything** — git retains every blob it has ever committed, so a fresh clone still
pulls the full 528 MB.

**Current tracked footprint:**

| Path | Size | Keep? |
|---|---|---|
| `data/cleaned/` | 147 MB | No — regenerable output of ETL notebooks 01–09 |
| `resources/` | 132 MB | Mostly no — 46 MB .pptx, 23 MB .gif, 18 MB .webp |
| `data/raw/` | 112 MB | No — all re-downloadable from public sources |
| `notebooks/` | 48 MB | Shrinkable — size is embedded cell outputs, not code |
| `docs/static/resources/` | 26 MB | **KEEP** — GitHub Pages serves these to the live dashboard |
| `node_modules/` | (untracked) | Purge from history |

**Plan.** One `git filter-repo` pass covering everything at once — doing it twice
is twice the disruption.

```bash
brew install git-filter-repo          # or: pip install git-filter-repo

# Work on a throwaway clone first and verify the result before touching origin
git clone --no-local . ../hfc-rewrite-test
cd ../hfc-rewrite-test

git filter-repo \
  --path node_modules --path data/raw --path data/cleaned \
  --path resources/Floodlines_lightning_talk.pptx \
  --invert-paths
```

**Before running:**

- [ ] Decide the fate of `data/raw/` and `data/cleaned/`. Removing them from history
      means a fresh clone cannot re-run the Vermont notebooks without first
      re-downloading every source. Acceptable if the Vermont pipeline is being
      retired in favor of the NC work; not acceptable if Bryan's analysis must stay
      reproducible from a clone. **This is a judgment call, not a mechanical step.**
- [ ] Confirm `docs/static/resources/` is excluded from the purge — removing it
      breaks the live Vermont dashboard on GitHub Pages.
- [ ] Strip notebook outputs rather than deleting notebooks (`nbstripout`), so the
      code survives and only the embedded images go.
- [ ] Preserve the upstream attribution: keep `LICENSE` and the Floodlines credit in
      `README.md` intact through the rewrite. MIT requires the copyright notice to
      survive.

**After running:** every commit hash changes. Requires `git push --force`, and any
other clone must be re-cloned rather than pulled. `filter-repo` also drops the
`origin` remote as a safety measure — re-add it before pushing.

---

## 2. Analysis follow-ups

- [ ] **Resolve the `$0 obligated` records.** Several North Topsail Beach awards
      list properties but zero federal share. Pending, withdrawn, and cancelled look
      identical in this dataset, and the difference is material to the argument.
      Check the `status` field, then confirm against NCEM records.
- [ ] **Verify North Topsail Beach's Local Hazard Mitigation Plan status.** HMGP requires the
      applicant community to have a current FEMA-approved local hazard mitigation plan. This is
      now the ONLY remaining explanation that would excuse NTB's absence, because availability
      itself is settled (see below). Check adoption and expiration dates, and whether NTB is a
      participating jurisdiction in Onslow County's multi-jurisdictional plan. Note Kure Beach
      applied for a planning grant (91.1) under DR-4827, so these towns actively manage plan
      currency.

      **Availability is established.** DR-4827 (Helene, 2024) struck western NC but funded
      projects in 65 counties including all 8 coastal ones — 17 coastal projects from 12
      applicants, among them Kure Beach, Wrightsville Beach and Southern Shores (all NTB
      comparison towns), plus Jacksonville and Onslow County itself. NTB filed nothing. Its most
      recent HMA record of any kind is FY2018.

- [ ] **Verify CBRS unit boundaries** for North Topsail Beach against the FWS CBRS
      mapper. CBRS restricts federal flood insurance availability, and FMA targets
      NFIP-insured properties — so CBRS could independently explain the absence of
      FMA awards. This is the strongest counterargument to the thesis; resolve it
      early.
- [ ] **Confirm the cost-share finding.** North Topsail Beach averages 75% federal
      share; Carolina Beach averages 90%. Verify that the 90%/100% tiers attach to
      FMA repetitive-loss and severe-repetitive-loss properties as expected.
- [ ] **Inflation-adjust.** All NC dollars are currently nominal. The Vermont
      pipeline already has CPI-U adjustment to 2025 dollars — port it.
- [ ] **Add CRS class and CBRS status** as variables in `scripts/build_nc_data.py`.
- [ ] **Add ACS demographics** (needs a free Census API key) so funding can be
      normalized per capita and per housing unit.
- [ ] **Public records requests** to the Town of North Topsail Beach and NCEM for
      grant administration staffing and homeowner communications — and, for each NTB
      project identifier, why properties put forward were never mitigated. Note the
      HMA dataset *does* carry unsuccessful applications in its `status` field
      (Denied / Not Selected / Withdrawn / Void), so the records request is narrower
      than first assumed: it is about why approved projects delivered nothing, not
      about whether applications existed.
- [ ] **Isolate the $1.37M Raleigh FMA property.** The 2017 deed cluster is confirmed HMGP
      (Wake Co. 016808-02777 recites Stafford Act § 5170c). The single FMA property is among
      the other ~20 individual-owner conveyances in the 2015-05-22 → 2018-09-13 window; its
      deed should recite 42 U.S.C. § 4104c instead. Excise stamps ($2 per $1,000) confirm price.
- [ ] **Pull Onslow County's 7 completed acquisitions** from the Onslow Register of Deeds and
      check whether any parcel sat inside North Topsail Beach town limits. NTB completed zero
      itself, so the county is the only place its residents could have been served.
- [ ] **Re-check `docs/nc/data/unmatched.csv`** after every data rebuild. A comp town
      silently dropping to zero from a subrecipient spelling variant is the failure
      mode that would most damage the analysis.
