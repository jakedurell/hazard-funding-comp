/* =============================================================================
   Floodlines Guided Tour
   -----------------------------------------------------------------------------
   A ProPublica-style data story tour using Shepherd.js.

   Architecture:
   - Timestamped 30-day localStorage prompt window
   - Blocking welcome modal (accept / decline)
   - Floating overlay highlight element (no layout shifts, no z-index conflicts)
   - Idempotent start/restart with in-flight guards
   - Full cleanup on cancel, complete, or restart
   - Dashboard state is reset before the final step and on cleanup
   - Local vendor CSS/JS preferred; CDN fallback with visible error banner
   ============================================================================= */

(function () {
  'use strict';

  const SEEN_KEY    = 'floodlines_tour_seen_at_v1';
  const PROMPT_KEY  = 'floodlines_tour_prompted_at_v1';
  const EXPIRY_DAYS = 30;
  const DEFAULT_TOWN = 'Newport city';

  let tour = null;
  const state = {
    starting:         false,
    active:           false,
    requestedRestart: false,
    overlayEl:        null,
    repositionFn:     null
  };

  let savedSelectEl    = null;
  let savedSelectValue = null;

  /* ── time utilities ──────────────────────────────────────────────────────── */
  const msNow  = () => Date.now();
  const dayMs  = d => d * 86400000;
  function hasPromptExpired() {
    const t = localStorage.getItem(PROMPT_KEY);
    return !t || (msNow() - parseInt(t, 10) > dayMs(EXPIRY_DAYS));
  }
  function markPrompted() { localStorage.setItem(PROMPT_KEY, String(msNow())); }
  function markSeen()     { localStorage.setItem(SEEN_KEY,   String(msNow())); }

  /* ── asset loaders ───────────────────────────────────────────────────────── */
  function loadCss(href) {
    return new Promise((resolve, reject) => {
      if (document.querySelector('link[href="' + href + '"]')) return resolve();
      const l   = document.createElement('link');
      l.rel     = 'stylesheet';
      l.href    = href;
      let done  = false;
      const tid = setTimeout(() => { done = true; reject(new Error('CSS timeout: ' + href)); }, 8000);
      l.onload  = () => { if (!done) { clearTimeout(tid); resolve(); } };
      l.onerror = () => { if (!done) { clearTimeout(tid); reject(new Error('CSS failed: ' + href)); } };
      document.head.appendChild(l);
    });
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (window.Shepherd) return resolve();
      const s   = document.createElement('script');
      s.src     = src;
      s.async   = true;
      let done  = false;
      const tid = setTimeout(() => { done = true; reject(new Error('JS timeout: ' + src)); }, 10000);
      s.onload  = () => { if (!done) { clearTimeout(tid); resolve(); } };
      s.onerror = () => { if (!done) { clearTimeout(tid); reject(new Error('JS failed: ' + src)); } };
      document.head.appendChild(s);
    });
  }

  function injectStyle(id, css) {
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ── DOM utilities ───────────────────────────────────────────────────────── */
  function waitFor(selector, ms) {
    ms = ms || 3000;
    return new Promise(function (resolve) {
      var el = document.querySelector(selector);
      if (el) return resolve(el);
      var mo = new MutationObserver(function () {
        var e = document.querySelector(selector);
        if (e) { mo.disconnect(); resolve(e); }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(function () { mo.disconnect(); resolve(document.querySelector(selector)); }, ms);
    });
  }

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function scrollTo(el) {
    if (!el) return;
    try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
  }

  /* ── floating highlight overlay ──────────────────────────────────────────── */
  function ensureOverlay() {
    if (state.overlayEl) return state.overlayEl;
    var o = document.createElement('div');
    o.id = 'fl-tour-highlight';
    document.body.appendChild(o);
    state.overlayEl = o;
    return o;
  }

  function positionOverlay(el) {
    var o = ensureOverlay();
    if (!el) { o.style.display = 'none'; return; }
    var r   = el.getBoundingClientRect();
    var pad = 7;
    o.style.left    = (r.left + window.scrollX - pad) + 'px';
    o.style.top     = (r.top  + window.scrollY - pad) + 'px';
    o.style.width   = (Math.max(4, r.width)  + pad * 2) + 'px';
    o.style.height  = (Math.max(4, r.height) + pad * 2) + 'px';
    o.style.display = 'block';
  }

  function setHighlight(el) {
    clearHighlight();
    if (!el) return;
    positionOverlay(el);
    state.repositionFn = function () { positionOverlay(el); };
    window.addEventListener('scroll', state.repositionFn, true);
    window.addEventListener('resize', state.repositionFn);
  }

  function clearHighlight() {
    if (state.overlayEl) state.overlayEl.style.display = 'none';
    if (state.repositionFn) {
      window.removeEventListener('scroll', state.repositionFn, true);
      window.removeEventListener('resize', state.repositionFn);
      state.repositionFn = null;
    }
  }

  /* ── dashboard interaction helpers ──────────────────────────────────────── */

  /* Switch the primary model selector above the map.
     overlayValue: 'Total Risk' | 'Risk per Person' | 'FEMA Risk Index' */
  function switchPrimaryModel(overlayValue) {
    var group = document.querySelector('#model-selector-group');
    if (!group) return Promise.resolve();
    var input   = group.querySelector('input[data-overlay="' + overlayValue + '"]');
    if (!input) return Promise.resolve();
    var current = group.querySelector('input:checked');
    if (current === input) return Promise.resolve();
    input.checked = true;
    group.querySelectorAll('label').forEach(function (l) { l.classList.remove('active'); });
    var lbl = input.closest('label');
    if (lbl) lbl.classList.add('active');
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('input',  { bubbles: true }));
    return delay(800);
  }

  /* Switch the secondary model selector below the scatterplot. */
  function switchSecondaryModel(overlayValue) {
    var group = document.querySelector('#model-selector-group-secondary');
    if (!group) return Promise.resolve();
    var input   = group.querySelector('input[data-overlay="' + overlayValue + '"]');
    if (!input) return Promise.resolve();
    var current = group.querySelector('input:checked');
    if (current === input) return Promise.resolve();
    input.checked = true;
    group.querySelectorAll('label').forEach(function (l) { l.classList.remove('active'); });
    var lbl = input.closest('label');
    if (lbl) lbl.classList.add('active');
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('input',  { bubbles: true }));
    return delay(800);
  }

  /* Activate a choropleth button by its data-overlay value. */
  function switchChoropleth(overlayValue) {
    var btn = document.querySelector(
      '#choropleth-control button[data-overlay="' + overlayValue + '"],' +
      '#choropleth-control-special button[data-overlay="' + overlayValue + '"]'
    );
    if (!btn) return Promise.resolve();
    btn.click();
    return delay(700);
  }

  /* Set the Statewide Percentile / VT Avg toggle.
     relative = true => "Compared to VT Avg" */
  function setRelativeToggle(relative) {
    var toggle = document.querySelector('#toggle-relative');
    if (!toggle) return Promise.resolve();
    if (toggle.checked === relative) return Promise.resolve();
    toggle.checked = relative;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    return delay(600);
  }

  /* Activate a context layer button by its data-overlay value. */
  function activateContextLayer(overlayValue) {
    var btn = document.querySelector('#context-controls button[data-overlay="' + overlayValue + '"]');
    if (!btn) return Promise.resolve();
    if (!btn.classList.contains('active')) btn.click();
    return delay(700);
  }

  /* Deactivate a context layer button if active. */
  function deactivateContextLayer(overlayValue) {
    var btn = document.querySelector('#context-controls button[data-overlay="' + overlayValue + '"]');
    if (!btn) return Promise.resolve();
    if (btn.classList.contains('active')) btn.click();
    return delay(400);
  }

  /* Select a town for tour demonstration.
     Guards only against a genuine user selection (stats card already populated
     with a real town name). The sel.value guard is intentionally absent — the
     select commonly has a non-empty value before any user interaction.

     Dispatches both 'change' and 'input' so the dashboard's event listener
     (which listens for 'change' on #towns-dropdown) fires correctly.
     Does NOT scroll here — callers manage scrolling for better pacing. */
  function selectTown(townName) {
    var selectors = ['#towns-dropdown', '#towns-control select', 'select[name="town"]', 'select'];
    var sel = null;
    for (var i = 0; i < selectors.length; i++) {
      sel = document.querySelector(selectors[i]);
      if (sel) break;
    }
    if (!sel) return Promise.resolve(false);

    savedSelectEl    = sel;
    savedSelectValue = sel.value;

    var opts  = Array.from(sel.options || []);
    var lower = townName.toLowerCase();
    // 1. Exact text match (case-insensitive, trimmed)
    var opt = opts.find(function (o) { return o.text.trim().toLowerCase() === lower; });
    // 2. Exact value match
    if (!opt) opt = opts.find(function (o) { return o.value.toLowerCase() === lower; });
    // 3. Prefix match — handles 'Newport' vs 'Newport city'
    if (!opt) opt = opts.find(function (o) {
      var t = o.text.trim().toLowerCase();
      return t.indexOf(lower) === 0 || lower.indexOf(t) === 0;
    });
    // 4. Base-name match — strip trailing city/town/village suffix
    var strip = function (s) { return s.replace(/\s+(city|town|village|gore|grant)$/i, '').trim(); };
    if (!opt) opt = opts.find(function (o) {
      return strip(o.text.trim().toLowerCase()) === strip(lower);
    });
    // 5. Fallback: first non-empty option so the demo always shows something
    if (!opt) opt = opts.find(function (o) { return o.value !== '' && o.text.trim().length > 0; });
    if (!opt) return Promise.resolve(false);

    sel.value = opt.value;
    // Fire both events — dashboard wired to 'change', but belt-and-suspenders
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    sel.dispatchEvent(new Event('input',  { bubbles: true }));

    // Give the map time to zoom before returning
    return delay(400).then(function () { return true; });
  }

  function restoreSelectEl() {
    if (!savedSelectEl) return;
    try {
      savedSelectEl.value = savedSelectValue;
      savedSelectEl.dispatchEvent(new Event('input',  { bubbles: true }));
      savedSelectEl.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
    savedSelectEl    = null;
    savedSelectValue = null;
  }

  /* Reset the dashboard to its default post-load state:
     Quadrants active, State of Vermont 'top' selected, Risk per Person, Statewide Percentile, context layers off. */
  function resetDashboard() {
    return switchChoropleth('Quadrants')
      .then(function () { return selectTown('top'); }) // return to State in dropdown, which resets the stats card and map zoom
      .then(function () { return switchPrimaryModel('Risk per Person'); })
      .then(function () { return setRelativeToggle(false); })
      .then(function () { return deactivateContextLayer('Population'); })
      .then(function () { return deactivateContextLayer('Funding Bubble'); })
      .then(function () { return deactivateContextLayer('River Corridors'); })
      .then(function () { restoreSelectEl(); });
  }

  /* ── cleanup ─────────────────────────────────────────────────────────────── */
  function cleanup() {
    try { if (tour && typeof tour.hide === 'function') tour.hide(); } catch (_) {}
    tour = null;
    clearHighlight();
    var o = document.getElementById('fl-tour-highlight');
    if (o) o.remove();
    state.overlayEl = null;
    var modal = document.getElementById('fl-tour-welcome-modal');
    if (modal) modal.remove();
    var err = document.getElementById('fl-tour-error');
    if (err) err.remove();
    state.active   = false;
    state.starting = false;
    return resetDashboard();
  }

  /* ── Shepherd loader ─────────────────────────────────────────────────────── */
  function ensureShepherd() {
    if (window.Shepherd) return Promise.resolve();
    var localCss = './static/vendor/shepherd/shepherd.min.css';
    var localJs  = './static/vendor/shepherd/shepherd.v7.1.2.min.js';
    return loadCss(localCss)
      .then(function () { return loadScript(localJs); })
      .then(function () { if (window.Shepherd) return; throw new Error('local vendor missing'); })
      .catch(function () {
        return loadCss('https://cdn.jsdelivr.net/npm/shepherd.js@8.1.2/dist/css/shepherd.css')
          .then(function () { return loadScript('https://cdn.jsdelivr.net/npm/shepherd.js@8.1.2/dist/js/shepherd.min.js'); })
          .catch(function (err) { showLoadError(err); throw err; });
      });
  }

  function showLoadError(err) {
    if (document.getElementById('fl-tour-error')) return;
    var d = document.createElement('div');
    d.id = 'fl-tour-error';
    d.innerHTML =
      '<div class="fl-tour-error-inner">' +
        '<strong>Tour unavailable.</strong> Shepherd assets could not load. ' +
        'Place shepherd.css and shepherd.min.js in ./static/vendor/shepherd/, then ' +
        '<button id="fl-tour-retry">Retry</button>' +
      '</div>';
    (document.querySelector('.dashboard-header') || document.body).appendChild(d);
    document.getElementById('fl-tour-retry').addEventListener('click', function () {
      d.remove();
      ensureShepherd().then(function () { if (tour) tour.start(); });
    });
    console.error('Floodlines tour asset error:', err);
  }

  /* ── welcome modal ───────────────────────────────────────────────────────── */
  function showWelcomeModal() {
    if (document.getElementById('fl-tour-welcome-modal')) return;
    var overlay = document.createElement('div');
    overlay.id = 'fl-tour-welcome-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'fl-tour-modal-title');
    overlay.innerHTML =
      '<div class="fl-tour-modal-card">' +
        '<div class="fl-tour-modal-header">' +
          '<h2 id="fl-tour-modal-title">First time here?</h2>' +
        '</div>' +
        '<div class="fl-tour-modal-body">' +
          '<p>Floodlines maps flood risk, social vulnerability, and FEMA mitigation funding across Vermont — and asks whether the money goes where it&rsquo;s needed most.</p>' +
          '<p>A short guided tour (about one minute) explains how to read the map, what the models mean, and how to interpret the charts and rankings.</p>' +
        '</div>' +
        '<div class="fl-tour-modal-footer">' +
          '<button id="fl-tour-modal-decline" class="fl-tour-btn fl-tour-btn-ghost">Not now</button>' +
          '<button id="fl-tour-modal-accept"  class="fl-tour-btn fl-tour-btn-primary">Take the tour</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    var accept  = document.getElementById('fl-tour-modal-accept');
    var decline = document.getElementById('fl-tour-modal-decline');
    accept.focus();
    accept.addEventListener('click', function () {
      markPrompted();
      overlay.remove();
      startTour();
    });
    decline.addEventListener('click', function () {
      markPrompted();
      overlay.remove();
    });
  }

  /* ── build tour ──────────────────────────────────────────────────────────── */
  function buildTour() {
    if (!window.Shepherd) return Promise.resolve(null);

    return Promise.all([
      waitFor('#map-id',                         5000),
      waitFor('#quadrants-button',               4000),
      waitFor('#model-selector-group',           4000),
      waitFor('#model-selector-group-secondary', 2000),
      waitFor('#choropleth-control',             2000),
      waitFor('#plot-container',                 4000),
      waitFor('#rankings-container',             4000),
      waitFor('#stats-card',                     4000),
      waitFor('#context-controls',               2000),
      waitFor('.rank-jumps',                     4000)
    ]).then(function (els) {
      var mapEl                = els[0];
      var quadrantsBtn         = els[1];
      var modelGroup           = els[2];
      var modelGroupSecondary  = els[3];
      var choroplethCtrl       = els[4];
      var plotContainer        = els[5];
      var rankingsContainer    = els[6];
      var statsCard            = els[7];
      var contextControls      = els[8];
      var rankJumps            = els[9];

      tour = new Shepherd.Tour({
        useModalOverlay: true,
        defaultStepOptions: {
          cancelIcon: { enabled: true },
          classes:    'shepherd-floodlines',
          scrollTo:   false
        }
      });

      function s(opts) { tour.addStep(opts); }
      var nav = [
        { text: '&larr; Back', classes: 'shepherd-button-secondary', action: function () { tour.back(); } },
        { text: 'Next &rarr;', classes: 'shepherd-button-primary',   action: function () { tour.next(); } }
      ];

      /* STEP 1 - Introduction */
      s({
        id:    'intro',
        text:
          '<p><b>Does mitigation funding reach the towns that need it most?</b></p>' +
          '<p>Floodlines compares flood risk, community vulnerability, and FEMA mitigation funding across Vermont.</p>' +
          '<p>This short tour introduces the dashboard and the main story it reveals. You can also <a href="article.html" target="_blank" rel="noopener">read the full analysis</a>.</p>',
        buttons: [
          { text: 'Skip tour',         classes: 'shepherd-button-secondary', action: function () { markPrompted(); tour.cancel(); } },
          { text: 'Start tour &rarr;', classes: 'shepherd-button-primary',   action: function () { tour.next(); } }
        ]
      });

      /* STEP 2 - Quadrant view on map */
      s({
        id:    'quadrant-map',
        text:
          '<p>This is the dashboard\'s starting view.</p>' +
          '<p>Each town is grouped by two things: <em>how much need it has</em>, and <em>how much FEMA mitigation funding it has received</em>. The legend explains the categories.<p>' +
          '<p>Communities with high need but little funding are a central focus of this analysis.</p>',
        attachTo: mapEl ? { element: mapEl, on: 'bottom' } : undefined,
        beforeShowPromise: function () {
          return switchChoropleth('Quadrants')
            .then(function () { return switchPrimaryModel('Risk per Person'); })
            .then(function () { return setRelativeToggle(false); })
            .then(function () { scrollTo(mapEl); return delay(400); })
            .then(function () { setHighlight(mapEl); }); // introduce map and quadrants view
        },
        when: { hide: function () { clearHighlight(); } },
        buttons: nav
      });

      /* STEP 3 - Quadrant button */
      s({
        id:    'quadrant-button',
        text:
          '<p>This button returns to the main view at any time.</p>',
        attachTo: quadrantsBtn ? { element: quadrantsBtn, on: 'bottom' } : undefined,
        beforeShowPromise: function () {
          scrollTo(quadrantsBtn);
          return delay(300).then(function () { setHighlight(quadrantsBtn); }); // introduce quadrants button
        },
        when: { hide: function () { clearHighlight(); } },
        buttons: nav
      });

      /* STEP 4 - Model selector intro */
      s({
        id:    'model-selector',
        text:
          '<p><b>There is no single way to measure flood risk.</b></p>' +
          '<p>Some approaches emphasize total losses. Others focus on risk relative to population. FEMA also publishes its own risk framework.</p>' +
          '<p>Changing the model changes which communities appear most at risk.</p>',
        attachTo: modelGroup ? { element: modelGroup, on: 'top' } : undefined,
        beforeShowPromise: function () {
          scrollTo(modelGroup);
          return delay(400)
            .then(function () { setHighlight(modelGroup); return delay(400); }) // show controls and switch a model to demonstrate use
            .then(function () { return switchPrimaryModel('FEMA Risk Index'); });
        },
        when: { hide: function () { clearHighlight(); } },
        buttons: nav
      });

      /* STEP 5 - Model change on map */
      s({
        id:    'model-change',
        text:
          '<p>As the definition of risk changes, some towns rise while others fall.</p>' +
          '<p>There is no universally correct model. One of the project\'s central questions is how measurement choices shape our understanding of need.</p>',
        attachTo: mapEl ? { element: mapEl, on: 'bottom' } : undefined,
        beforeShowPromise: function () {
          scrollTo(mapEl);
          return delay(400)
            .then(function () { setHighlight(mapEl); }) // switch models while map is highlighted so the connection is clear
            .then(function () { return delay(300); })
            .then(function () { return switchPrimaryModel('Risk per Person'); })
            .then(function () { return delay(300); })
            .then(function () { return switchPrimaryModel('Total Risk'); });
        },
        when: { hide: function () { clearHighlight(); } },
        buttons: nav
      });

      /* STEP 6 - Funding Gap controls */
      s({
        id:    'funding-gap-controls',
        text:
          '<p>These controls change what the map displays. For this tour, we\'ve switched to <strong>Funding Gap</strong> and enabled comparison against the Vermont average.</p>',
        attachTo: choroplethCtrl ? { element: choroplethCtrl, on: 'top' } : undefined,
        beforeShowPromise: function () {
          return delay(400)
            .then(function () {
              var toggleEl  = document.querySelector('#toggle-relative');
              var container = toggleEl
                ? (toggleEl.closest('[class*="col-"]') || toggleEl.parentElement)
                : null;
              scrollTo(toggleEl || container);
              setHighlight(container || toggleEl);
              return delay(400);
            }) // scroll to toggle and activate it
            .then(function () { return setRelativeToggle(true); })
            .then(function () { return delay(400); })
            .then(function () { scrollTo(choroplethCtrl); }) // then scroll to choropleth controls and activate the Gap view
            .then(function () { setHighlight(choroplethCtrl); })
            .then(function () { return switchChoropleth('Funding Gap'); })
        },
        when: { hide: function () { clearHighlight(); } },
        buttons: nav
      });

      /* STEP 7 - Funding Gap map result */
      s({
        id:    'funding-gap-map',
        text:
          '<p>This map compares modeled need with FEMA mitigation funding received.</p>' +
          '<p>Red towns appear to have received less funding than their risk profile suggests. Blue towns have received more.</p>' +
          '<p>This is the project\'s central question: <b>where does need exceed investment before disaster strikes?</b></p>',
        attachTo: mapEl ? { element: mapEl, on: 'bottom' } : undefined,
        beforeShowPromise: function () {
          scrollTo(mapEl);
          switchChoropleth('Funding Gap'); // ensure map is on Gap view before highlighting
          return delay(400).then(function () { setHighlight(mapEl); });
        },
        when: { hide: function () { clearHighlight(); } },
        buttons: nav
      });

      /* STEP 8 - Scatterplot: three visible model switches so dots move twice */
      s({
        id:    'scatterplot',
        text:
          '<p>Each bubble represents a Vermont town. Bubble size reflects population.</p>' +
          '<p>Need is shown on the horizontal axis and funding on the vertical axis. The model controls below are synchronized with the map.</p>' +
          '<p>Watch how towns move as different definitions of risk are applied, favoring small or large towns depending on the model.</p>',
        attachTo: plotContainer ? { element: plotContainer, on: 'top' } : undefined,
        beforeShowPromise: function () {
          // scrollTo(plotContainer);
          return delay(500)
            .then(function () { setHighlight(modelGroupSecondary); }) // highlight the secondary model selector group before switching models so the connection is clear
            .then(function () { scrollTo(modelGroupSecondary); })
            .then(function () { return delay(400); })
            .then(function () { return switchPrimaryModel('FEMA Risk Index'); })
            .then(function () { return delay(800); })
            .then(function () { scrollTo(plotContainer); }) // highlight the plot container and switch models to show impact
            .then(function () { setHighlight(plotContainer); })
            .then(function () { return switchSecondaryModel('Total Risk'); })
            .then(function () { return delay(1000); })
            .then(function () { return switchSecondaryModel('Risk per Person'); })
            .then(function () { return delay(1000); })
            .then(function () { return switchSecondaryModel('FEMA Risk Index'); })
            .then(function () { return delay(1000); });
        },
        when: { hide: function () { clearHighlight(); } },
        buttons: nav
      });

      /* STEP 9 - Rankings table */
      s({
        id:    'rankings',
        text:
          '<p>The rankings table shows the same data behind the map and scatterplot. It makes it easier to identify specific towns and compare them directly.</p>',
        attachTo: rankingsContainer ? { element: rankingsContainer, on: 'top' } : undefined,
        beforeShowPromise: function () {
          scrollTo(rankingsContainer);
          return delay(400).then(function () { setHighlight(rankingsContainer); });
        },
        when: { hide: function () { clearHighlight(); } },
        buttons: nav
      });

      /* STEP 10 - Rankings navigation */
      s({
        id:    'rankings-nav',
        text:
          '<p>These shortcuts jump to notable locations in the rankings, including top-ranked towns and statewide averages.</p>',
        attachTo: rankJumps ? { element: rankJumps, on: 'top' } : undefined,
        beforeShowPromise: function () {
          scrollTo(rankJumps);
          return delay(400).then(function () {
            setHighlight(rankJumps);
            var jumpVt = document.getElementById('jump-vt');
            if (jumpVt && !jumpVt.disabled) jumpVt.click();
            return delay(600);
          }).then(function () {
              var toggleEl  = document.querySelector('#toggle-relative-secondary');
              var container = toggleEl
                ? (toggleEl.closest('[class*="col-"]') || toggleEl.parentElement)
                : null;
              scrollTo(toggleEl || container);
              setHighlight(container || toggleEl);
              return delay(400);
            }).then(function () {
            return setRelativeToggle(false);
          }).then(function () { scrollTo(rankJumps); });
        },
        when: { hide: function () { clearHighlight(); } },
        buttons: nav
      });

      /* STEP 11 - Town snapshot */
      s({
        id:    'town-snapshot',
        text:
          '<p>Select any town to zoom in on the map and see a local snapshot.</p>' +
          '<p>Key measures of risk, vulnerability, funding, and funding alignment are summarized here.</p>',
        attachTo: statsCard ? { element: statsCard, on: 'top' } : undefined,
        beforeShowPromise: function () {
          return switchChoropleth('Quadrants')
            .then(function () { return switchPrimaryModel('Risk per Person'); })
            .then(function () { return setRelativeToggle(false); })
            .then(function () { scrollTo(mapEl); })
            .then(function () { return delay(400); })
            .then(function () { return selectTown(DEFAULT_TOWN); }) // zoom into selected town
            .then(function () { return delay(2000); }) // pause on zoomed town before stats card
            .then(function () { scrollTo(statsCard); }) // show stats card
            .then(function () { return delay(500); })
            .then(function () { setHighlight(statsCard); });
        },
        when: { hide: function () { clearHighlight(); } },
        buttons: nav
      });

      /* STEP 12 - Context layers: scroll to controls -> activate -> scroll to map -> activate more */
      s({
        id:    'context-layers',
        text:
          '<p>These optional layers add geographic context.</p>' +
          '<p>River corridors, population patterns, and funding locations help explain why some towns appear where they do in the analysis.</p>',
        attachTo: mapEl ? { element: mapEl, on: 'bottom' } : undefined,
        beforeShowPromise: function () {
          scrollTo(contextControls);
          return delay(400)
            .then(function () { return selectTown('top'); }) // reset to State after town zoom
            .then(function () { setHighlight(contextControls); }) // show controls before activating so the connection is clear
            .then(function () { return delay(700); })
            .then(function () { return activateContextLayer('Population'); })
            .then(function () { return delay(700); })
            .then(function () { scrollTo(mapEl); setHighlight(mapEl); }) // show map and activate more layers to demonstrate how context adds up
            .then(function () { return delay(400); })
            .then(function () { return activateContextLayer('River Corridors'); })
            .then(function () { return delay(700); })
            .then(function () { return activateContextLayer('Funding Bubble'); })
            .then(function () { return delay(700); });
        },
        when: { hide: function () { clearHighlight(); } },
        buttons: nav
      });

      /* STEP 13 - Conclusion: full dashboard reset before handing control back */
      s({
        id:    'conclusion',
        text:
          "<p><b>You're ready to explore.</b></p>" +
          '<p>The analysis finds that funding is only weakly related to modeled need, while past flood damages and insurance claims are more strongly associated with where funding goes.</p>' +
          '<p>The results suggest a system that responds more to previous disasters than to future risk.</p>' +
          '<p>Try comparing towns, switching models, and seeing which communities consistently appear underfunded.</p>' +
          '<p>You can restart this tour anytime using the header button.</p>',
        beforeShowPromise: function () {
          return resetDashboard()
            .then(function () { scrollTo(mapEl); clearHighlight(); });
        },
        buttons: [
          { text: 'Restart tour', classes: 'shepherd-button-secondary', action: function () { state.requestedRestart = true; tour.cancel(); } },
          { text: 'Done',         classes: 'shepherd-button-primary',   action: function () { markSeen(); tour.complete(); } }
        ]
      });

      /* lifecycle: both cancel and complete trigger cleanup and optional restart */
      function onTeardown() {
        state.active = false;
        cleanup().then(function () {
          if (state.requestedRestart) {
            state.requestedRestart = false;
            setTimeout(function () { startTour(); }, 80);
          }
        });
      }
      tour.on('cancel',   onTeardown);
      tour.on('complete', onTeardown);

      return tour;
    });
  }

  /* ── startTour (idempotent) ──────────────────────────────────────────────── */
  function startTour() {
    if (state.starting || state.active) return;
    state.starting = true;
    ensureShepherd()
      .then(function () { return buildTour(); })
      .then(function () {
        if (tour) {
          state.active = true;
          tour.start();
        }
      })
      .catch(function (err) {
        console.warn('Floodlines tour start failed:', err);
        state.active = false;
      })
      .finally(function () {
        state.starting = false;
      });
  }

  /* ── restartTour (safe) ──────────────────────────────────────────────────── */
  function restartTour() {
    if (state.starting) { state.requestedRestart = true; return; }
    if (state.active && tour) { state.requestedRestart = true; tour.cancel(); return; }
    cleanup().then(function () { startTour(); });
  }

  /* ── auto-prompt on load ─────────────────────────────────────────────────── */
  window.addEventListener('load', function () {
    if (hasPromptExpired()) showWelcomeModal();

    var navTarget = document.querySelector('.navbar-right .navbar-nav-wrap')
                 || document.querySelector('.navbar .navbar-right')
                 || document.querySelector('.dashboard-header');
    if (navTarget && !document.getElementById('fl-tour-restart-btn')) {
      var btn = document.createElement('button');
      btn.id        = 'fl-tour-restart-btn';
      btn.className = 'btn btn-link fl-tour-restart-btn';
      btn.setAttribute('aria-label', 'Take the guided tour');
      btn.textContent = 'Take tour';
      btn.addEventListener('click', function () { restartTour(); });
      navTarget.appendChild(btn);
    }
  });

  /* ── runtime styles (structural only; aesthetics in tour.css) ────────────── */
  injectStyle('fl-tour-runtime', [
    '#fl-tour-highlight{',
      'position:absolute;pointer-events:none;',
      'border:2px solid #f5a623;border-radius:6px;',
      'box-shadow:0 0 0 2000px rgba(0,0,0,0.20);',
      'transition:left 180ms ease,top 180ms ease,width 180ms ease,height 180ms ease;',
      'z-index:9990;display:none;}',
    '#fl-tour-welcome-modal{',
      'position:fixed;inset:0;',
      'background:rgba(10,20,40,0.55);',
      'display:flex;align-items:center;justify-content:center;',
      'z-index:9999;font-family:inherit;}'
  ].join(''));

  /* ── public API ──────────────────────────────────────────────────────────── */
  window.restartTour = restartTour;
  window.FloodlinesTour = {
    start:   startTour,
    restart: restartTour,
    isSeen:  function () { return !!localStorage.getItem(SEEN_KEY); }
  };

}());
