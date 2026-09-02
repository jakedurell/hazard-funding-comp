/* ==========================================================
   Reef Advocate — shared page furniture
   One source for the data-currency stamp and the disclaimer, so the
   wording cannot drift between pages.
   ========================================================== */

/* The disclaimer is required on every page. Edit here only. */
const REEF_DISCLAIMER = `
  <h3>Please read before relying on anything here</h3>
  <p>
    <b>This data is not verified.</b> It is summarised and compiled from public federal and state records,
    and presented <b>with the assistance of AI</b>, which may have applied inaccurate methods, matched records
    incorrectly, or misstated what a figure represents. Nothing here has been audited.
  </p>
  <p>
    Treat every number as a pointer to a primary source, not as a finding. <b>Verify directly with the source
    before relying on any of it</b> — the underlying datasets and record links are listed on the
    <a href="/#sources">sources</a> page.
  </p>
  <p>
    In addition to this disclaimer, the terms at
    <a href="https://reefadvocate.com/legalprivacy">reefadvocate.com/legalprivacy</a> apply to this site.
  </p>`;

function reefDisclaimer(sel) {
  const el = document.querySelector(sel);
  if (el) el.innerHTML = REEF_DISCLAIMER;
}

/* Data-currency stamp — reads the build metadata out of the payload so the
   date shown is always the date the federal data was actually pulled. */
function reefStamp(sel, payloadUrl) {
  const el = document.querySelector(sel);
  if (!el) return;
  const fmt = iso => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d))
      .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  };
  // revalidate — a stale payload here shows a wrong "data pulled" date
  fetch(payloadUrl, { cache: 'no-cache' })
    .then(r => r.json())
    .then(d => {
      const m = d.meta || {};
      el.innerHTML = `<span class="dot"></span>`
        + `<span>Federal source data pulled <b>${fmt(m.fetched)}</b></span>`
        + (m.built && m.built !== m.fetched ? `<span>· page data rebuilt ${fmt(m.built)}</span>` : '')
        + `<span>· dollars are nominal</span>`;
    })
    .catch(() => { el.innerHTML = `<span class="dot" style="background:var(--critical)"></span>`
        + `<span>Data currency unavailable — could not read the source payload</span>`; });
}
