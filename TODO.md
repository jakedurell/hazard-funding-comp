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
      sub-application records including unsuccessful and withdrawn applications,
      grant administration staffing, and homeowner communications. The HMA dataset
      records approved projects only and cannot show inaction on its own.
- [ ] **Re-check `docs/nc/data/unmatched.csv`** after every data rebuild. A comp town
      silently dropping to zero from a subrecipient spelling variant is the failure
      mode that would most damage the analysis.
