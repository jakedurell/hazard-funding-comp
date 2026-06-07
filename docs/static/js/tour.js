/* Floodlines guided tour (production-ready):
   - Stable restart and idempotent start
   - Timestamped prompt window (30 days)
   - Blocking welcome modal (accept / decline)
   - Single overlay highlight (no layout shifts)
   - Guarded town selection (doesn't override user choice)
   - Uses Shepherd.js, with local vendor + CDN fallback
*/
(function () {
  const SEEN_KEY = 'floodlines_tour_seen_at_v1';
  const PROMPT_KEY = 'floodlines_tour_prompted_at_v1';
  const EXPIRY_DAYS = 30;
  const DEFAULT_TOWN = 'Newport';

  let tour = null;
  const state = {
    starting: false,
    active: false,
    requestedRestart: false,
    overlayEl: null,
    repositionHandler: null
  };

  let originalSelect = null;
  let originalSelectValue = null;

  /* Utilities */
  const nowMs = () => Date.now();
  const daysToMs = d => d * 24 * 60 * 60 * 1000;

  function hasPromptExpired() {
    const t = localStorage.getItem(PROMPT_KEY);
    if (!t) return true;
    return nowMs() - parseInt(t, 10) > daysToMs(EXPIRY_DAYS);
  }
  function markPrompted() { localStorage.setItem(PROMPT_KEY, String(nowMs())); }
  function markTourSeen() { localStorage.setItem(SEEN_KEY, String(nowMs())); }

  /* --- asset loaders --- */
  function loadCss(href) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`link[href="${href}"]`)) return resolve();
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        l.onerror = null;
        l.onload = null;
        reject(new Error('timeout loading CSS ' + href));
      }, 8000);
      l.onload = () => { if (!timedOut) { clearTimeout(timeout); resolve(); } };
      l.onerror = () => { if (!timedOut) { clearTimeout(timeout); reject(new Error('failed to load ' + href)); } };
      document.head.appendChild(l);
    });
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (window.Shepherd) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        s.onload = null;
        s.onerror = null;
        reject(new Error('timeout loading script ' + src));
      }, 10000);
      s.onload = () => { if (!timedOut) { clearTimeout(timeout); resolve(); } };
      s.onerror = () => { if (!timedOut) { clearTimeout(timeout); reject(new Error('failed to load ' + src)); } };
      document.head.appendChild(s);
    });
  }

  function injectLocalStyle(css) {
    if (document.getElementById('floodlines-tour-style')) return;
    const s = document.createElement('style');
    s.id = 'floodlines-tour-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function waitFor(selector, timeout = 3000) {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const mo = new MutationObserver(() => {
        const e = document.querySelector(selector);
        if (e) {
          mo.disconnect();
          resolve(e);
        }
      });
      mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
      setTimeout(() => {
        mo.disconnect();
        resolve(document.querySelector(selector));
      }, timeout);
    });
  }

  /* --- single overlay highlight (no layout shifts) --- */
  function createOverlay() {
    if (state.overlayEl) return state.overlayEl;
    const o = document.createElement('div');
    o.id = 'floodlines-tour-overlay';
    o.style.position = 'absolute';
    o.style.pointerEvents = 'none';
    o.style.border = '2px solid rgba(255,165,0,0.95)';
    o.style.borderRadius = '6px';
    o.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
    o.style.transition = 'all 180ms ease';
    o.style.zIndex = '5000';
    o.style.display = 'none';
    document.body.appendChild(o);
    state.overlayEl = o;
    return o;
  }

  function positionOverlay(overlay, el) {
    if (!el || !overlay) return;
    const r = el.getBoundingClientRect();
    const pad = 6;
    overlay.style.left = (r.left + window.scrollX - pad) + 'px';
    overlay.style.top = (r.top + window.scrollY - pad) + 'px';
    overlay.style.width = (Math.max(8, r.width) + pad * 2) + 'px';
    overlay.style.height = (Math.max(8, r.height) + pad * 2) + 'px';
    overlay.style.display = 'block';
  }

  function setHighlightElement(el) {
    clearHighlight();
    if (!el) return;
    const overlay = createOverlay();
    positionOverlay(overlay, el);
    state.repositionHandler = () => positionOverlay(overlay, el);
    window.addEventListener('scroll', state.repositionHandler, true);
    window.addEventListener('resize', state.repositionHandler);
  }

  function clearHighlight() {
    if (!state.overlayEl) return;
    state.overlayEl.style.display = 'none';
    if (state.repositionHandler) {
      window.removeEventListener('scroll', state.repositionHandler, true);
      window.removeEventListener('resize', state.repositionHandler);
      state.repositionHandler = null;
    }
  }

  /* --- guarded town selection --- */
  function selectTownForTour(townName = DEFAULT_TOWN) {
    const possible = ['#towns-dropdown', '#towns-control select', 'select[name="town"]', 'select[name="towns"]', 'select'];
    let sel = null;
    for (const s of possible) {
      sel = document.querySelector(s);
      if (sel) break;
    }

    // guard: don't override if user already has a selection or stats panel populated
    const statsNameEl = document.getElementById('stats-town-name');
    const statsName = statsNameEl && statsNameEl.textContent ? statsNameEl.textContent.trim() : '';
    const statsPopulated = statsName && statsName.toLowerCase() !== 'town snapshot';
    const selectHasValue = sel && sel.value && sel.value !== '';
    if (statsPopulated || selectHasValue) return Promise.resolve(false);

    if (!sel) return Promise.resolve(false);

    originalSelect = sel;
    originalSelectValue = sel.value;

    const optArray = Array.from(sel.options || []);
    let target = optArray.find(o => o.text && o.text.trim().toLowerCase() === townName.toLowerCase());
    if (!target) target = optArray.find(o => o.value && o.value.trim().toLowerCase() === townName.toLowerCase());
    if (!target) target = optArray.find(o => o.text && o.text.trim().length > 0);
    if (!target) return Promise.resolve(false);

    sel.value = target.value;
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));

    const stats = document.getElementById('stats-card');
    if (stats) {
      try { stats.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    }

    return new Promise((res) => setTimeout(res, 600));
  }

  function restoreTownSelection() {
    if (!originalSelect) return;
    try {
      originalSelect.value = originalSelectValue;
      originalSelect.dispatchEvent(new Event('input', { bubbles: true }));
      originalSelect.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {}
    originalSelect = null;
    originalSelectValue = null;
  }

  /* --- cleanup: idempotent and safe --- */
  function cleanup() {
    try { if (tour && typeof tour.hide === 'function') tour.hide(); } catch (e) {}
    tour = null;
    clearHighlight();
    restoreTownSelection();
    const modal = document.getElementById('floodlines-tour-welcome-modal');
    if (modal) modal.remove();
    const err = document.getElementById('floodlines-tour-error');
    if (err) err.remove();
    state.active = false;
    state.starting = false;
  }

  /* --- Shepherd loader with local vendor + CDN fallback --- */
  async function ensureShepherd() {
    if (window.Shepherd) return;
    const localCss = './static/vendor/css/shepherd.min.css';
    const localJs = './static/vendor/js/shepherd.v7.1.2.min.js';
    try {
      await loadCss(localCss);
      await loadScript(localJs);
      if (window.Shepherd) return;
    } catch (e) {
      // try CDN fallback
    }
    const cdnCss = 'https://cdn.jsdelivr.net/npm/shepherd.js@8.1.2/dist/css/shepherd.css';
    const cdnJs = 'https://cdn.jsdelivr.net/npm/shepherd.js@8.1.2/dist/js/shepherd.min.js';
    try {
      await loadCss(cdnCss);
      await loadScript(cdnJs);
      return;
    } catch (err) {
      showTourLoadError(err);
    }
  }

  function showTourLoadError(err) {
    if (document.getElementById('floodlines-tour-error')) return;
    const container = document.createElement('div');
    container.id = 'floodlines-tour-error';
    container.style.margin = '12px';
    container.style.padding = '10px 12px';
    container.style.background = 'rgba(255,245,240,0.98)';
    container.style.border = '1px solid #e6b8b8';
    container.style.borderRadius = '6px';
    container.style.fontSize = '13px';
    container.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <div style="flex:1;min-width:200px;">Tour unavailable: Shepherd assets could not be loaded (cross-origin or offline). To fix, place <strong>shepherd.css</strong> and <strong>shepherd.min.js</strong> into <code>./static/vendor/shepherd/</code>.</div>
        <div style="white-space:nowrap">
          <button id="floodlines-tour-retry-local" class="btn btn-primary btn-sm">Retry</button>
          <button id="floodlines-tour-show-ids" class="btn btn-link btn-sm">Show files</button>
        </div>
      </div>
      <div id="floodlines-tour-instructions" style="display:none;margin-top:8px;font-family:monospace;font-size:12px;">
        Expected files:\n./static/vendor/shepherd/shepherd.css\n./static/vendor/shepherd/shepherd.min.js\nCDN: https://cdn.jsdelivr.net/npm/shepherd.js@8.1.2/
      </div>
    `;
    const attach = document.querySelector('.dashboard-header') || document.body;
    attach.appendChild(container);
    document.getElementById('floodlines-tour-retry-local').addEventListener('click', () => {
      container.remove();
      ensureShepherd().then(() => { if (tour) tour.start(); });
    });
    document.getElementById('floodlines-tour-show-ids').addEventListener('click', () => {
      const ins = document.getElementById('floodlines-tour-instructions');
      ins.style.display = (ins.style.display === 'none') ? 'block' : 'none';
    });
    console.error('Floodlines tour: Shepherd load error', err);
  }

  /* --- Welcome modal (blocking) --- */
  function createWelcomeModal() {
    if (document.getElementById('floodlines-tour-welcome-modal')) return;
    const overlay = document.createElement('div');
    overlay.id = 'floodlines-tour-welcome-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.45)';
    overlay.style.zIndex = '6000';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    const card = document.createElement('div');
    card.className = 'tour-welcome-card';
    card.style.background = '#fff';
    card.style.padding = '18px';
    card.style.borderRadius = '6px';
    card.style.maxWidth = '720px';
    card.style.width = 'calc(100% - 40px)';
    card.style.boxShadow = '0 10px 30px rgba(0,0,0,0.12)';
    card.innerHTML = `
      <h3 style="margin-top:0;margin-bottom:6px;">New here? Take a quick tour</h3>
      <p style="margin:0 0 12px 0;color:#333;">A short, focused tour (about one minute) shows the dashboard’s central question and the main interactions for interpreting the map, models, and rankings.</p>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
        <button id="floodlines-tour-decline" class="btn btn-link">Not now</button>
        <button id="floodlines-tour-accept" class="btn btn-primary">Take the tour</button>
      </div>
    `;
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const accept = document.getElementById('floodlines-tour-accept');
    const decline = document.getElementById('floodlines-tour-decline');
    accept.focus();
    accept.addEventListener('click', () => {
      markPrompted();
      // do not mark seen yet — mark on complete
      overlay.remove();
      startTour();
    });
    decline.addEventListener('click', () => {
      markPrompted();
      overlay.remove();
    });
  }

  function showWelcomeIfNeeded() {
    if (!hasPromptExpired()) return;
    createWelcomeModal();
  }

  /* --- Build the tour steps (async) --- */
  async function buildTour() {
    if (!window.Shepherd) return null;

    // wait for important elements; tolerate missing ones
    const quadrantsBtn = await waitFor('#quadrants-button', 4000);
    const modelGroup = await waitFor('#model-selector-group', 4000);
    const modelGroupSecondary = await waitFor('#model-selector-group-secondary', 2000);
    const choroplethCtrl = await waitFor('#choropleth-control', 2000);
    const plotContainer = await waitFor('#plot-container', 4000);

    // create fresh tour instance
    tour = new Shepherd.Tour({
      defaultStepOptions: {
        cancelIcon: { enabled: true },
        classes: 'shepherd-theme-arrows shepherd-floodlines',
        scrollTo: { behavior: 'smooth', block: 'center' }
      },
      useModalOverlay: true
    });

    function safeSelectRadio(container, overlayLabel) {
      return new Promise((resolve) => {
        try {
          const cont = (typeof container === 'string') ? document.querySelector(container) : container;
          if (!cont) return resolve(false);
          const target = cont.querySelector(`input[data-overlay="${overlayLabel}"]`) || cont.querySelector('input');
          const current = cont.querySelector('input:checked');
          if (!target) return resolve(false);
          if (current === target) return resolve(true);
          try { target.checked = true; } catch (e) {}
          target.dispatchEvent(new Event('input', { bubbles: true }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
          // update label active classes
          const labels = cont.querySelectorAll('label');
          labels.forEach(l => l.classList.remove('active'));
          const parentLabel = target.closest('label');
          if (parentLabel) parentLabel.classList.add('active');
          setTimeout(() => resolve(true), 500);
        } catch (e) { resolve(false); }
      });
    }

    // STEP 1: Intro / Thesis
    tour.addStep({
      id: 'intro',
      title: 'Does funding follow risk?',
      text: 'This dashboard compares modeled flood need against FEMA mitigation funding. Rankings change depending on how risk is defined; the next steps show what to look for.',
      buttons: [
        { text: 'Skip', action: () => { markPrompted(); tour.cancel(); } },
        { text: 'Next', action: () => tour.next() }
      ]
    });

    // STEP 2: Quadrant analysis
    tour.addStep({
      id: 'quadrants',
      text: 'Quadrant Analysis groups towns by measured need and funding received. Look for upper-left (high-need, low-funding) and lower-right patterns.',
      attachTo: quadrantsBtn ? { element: quadrantsBtn, on: 'bottom' } : undefined,
      when: {
        show: () => setHighlightElement(quadrantsBtn || document.body),
        hide: () => clearHighlight()
      },
      buttons: [
        { text: 'Back', action: () => tour.back() },
        { text: 'Next', action: () => tour.next() }
      ]
    });

    // STEP 3: Primary model selector (simulate change)
    tour.addStep({
      id: 'primary-model',
      text: 'Changing the primary model reshuffles which towns appear most vulnerable: per-capita risk surfaces small exposed towns; total loss emphasizes larger towns.',
      attachTo: modelGroup ? { element: modelGroup, on: 'top' } : undefined,
      beforeShowPromise: () => safeSelectRadio(modelGroup, 'Total Risk'),
      when: {
        show: () => setHighlightElement(modelGroup || document.body),
        hide: () => clearHighlight()
      },
      buttons: [
        { text: 'Back', action: () => tour.back() },
        { text: 'Next', action: () => tour.next() }
      ]
    });

    // STEP 4: Secondary model / scatterplot
    tour.addStep({
      id: 'secondary-model',
      text: 'The scatterplot and rankings reveal statewide patterns; correlation is imperfect and some high-need towns receive little funding.',
      attachTo: modelGroupSecondary ? { element: modelGroupSecondary, on: 'top' } : (plotContainer ? { element: plotContainer, on: 'top' } : undefined),
      beforeShowPromise: () => (modelGroupSecondary ? safeSelectRadio(modelGroupSecondary, 'Total Risk') : new Promise(r => setTimeout(r, 300))),
      when: {
        show: () => setHighlightElement(modelGroupSecondary || plotContainer || document.body),
        hide: () => clearHighlight()
      },
      buttons: [
        { text: 'Back', action: () => tour.back() },
        { text: 'Next', action: () => tour.next() }
      ]
    });

    // STEP 5: Map exploration / context
    const mapAttach = choroplethCtrl || await waitFor('#toggle-relative-secondary', 1000);
    tour.addStep({
      id: 'map-context',
      text: 'Try different choropleth metrics, the relative vs percentile toggle, context layers, and the town dropdown to test patterns and drill into local snapshots.',
      attachTo: mapAttach ? { element: mapAttach, on: 'top' } : undefined,
      when: {
        show: () => setHighlightElement(mapAttach || document.body),
        hide: () => clearHighlight()
      },
      buttons: [
        { text: 'Back', action: () => tour.back() },
        { text: 'Next', action: () => tour.next() }
      ]
    });

    // STEP 6: End
    tour.addStep({
      id: 'end',
      title: 'You’re ready to explore',
      text: 'Explore the map and models. You can restart this tour anytime from the header.',
      buttons: [
        { text: 'Restart tour', action: () => { state.requestedRestart = true; tour.cancel(); } },
        { text: 'Done', action: () => { markPrompted(); tour.complete(); } }
      ]
    });

    // teardown handling
    tour.on('cancel', () => {
      state.active = false;
      cleanup();
      if (state.requestedRestart) {
        state.requestedRestart = false;
        setTimeout(() => startTour(), 80);
      }
    });
    tour.on('complete', () => {
      state.active = false;
      markTourSeen();
      cleanup();
      if (state.requestedRestart) {
        state.requestedRestart = false;
        setTimeout(() => startTour(), 80);
      }
    });

    return tour;
  }

  /* --- start / restart logic (idempotent) --- */
  async function startTour() {
    if (state.starting || state.active) return;
    state.starting = true;
    try {
      await ensureShepherd();
      if (!tour) await buildTour();
      if (tour) {
        tour.start();
        state.active = true;
      }
    } catch (e) {
      console.warn('Floodlines tour start failed', e);
    } finally {
      state.starting = false;
    }
  }

  function restartTour() {
    if (state.starting) { state.requestedRestart = true; return; }
    if (state.active && tour) { state.requestedRestart = true; tour.cancel(); return; }
    cleanup();
    startTour();
  }

  /* --- welcome modal and auto-prompting --- */
  function showWelcomeIfNeeded() {
    if (!hasPromptExpired()) return;
    createWelcomeModal();
  }

  /* --- minimal CSS injected for overlay and modal --- */
  injectLocalStyle(`
    #floodlines-tour-overlay { transition: all 180ms ease; pointer-events: none; }
    #floodlines-tour-welcome-modal { font-family: inherit; }
    .tour-welcome-card h3 { margin: 0 0 6px 0; }
    .tour-welcome-card p { margin: 0; color: #333; }
    @media (max-width:720px){ .tour-welcome-card{ padding:14px; } }
  `);

  // expose API
  window.restartTour = restartTour;
  window.FloodlinesTour = {
    start: startTour,
    restart: restartTour,
    isSeen: () => !!localStorage.getItem(SEEN_KEY)
  };

  // auto-run on load
  window.addEventListener('load', () => {
    showWelcomeIfNeeded();
    const navTarget = document.querySelector('.navbar-right .navbar-nav-wrap') || document.querySelector('.dashboard-header');
    if (navTarget && !document.getElementById('floodlines-tour-restart')) {
      const btn = document.createElement('button');
      btn.id = 'floodlines-tour-restart';
      btn.className = 'btn btn-link floodlines-tour-restart';
      btn.textContent = 'Take tour';
      btn.addEventListener('click', () => { restartTour(); });
      navTarget.appendChild(btn);
    }
  });

})();
