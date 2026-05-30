// Article-level glue: model toggle, image crossfade, and plot bootstrapping
(function () {
  const STORAGE_KEY = "floodlines_article_model";
  const DEFAULT_MODEL = "eal_per_capita";

  // Ensure metricEngine exists with minimal API expected by plots.js
  if (!window.metricEngine) {
    window.metricEngine = {
      baseMetric: "need",
      model: DEFAULT_MODEL,
      isRelative: true,
      overlayToBase: window.overlayToBase || { "Combined Need": "need" },
      getMetricKey() {
        const { baseMetric, model, isRelative } = this;
        if (!baseMetric) return null;
        if (["funding", "vulnerability", "claims"].includes(baseMetric)) {
          return isRelative ? `${baseMetric}_rel` : `${baseMetric}_rank`;
        }
        return isRelative
          ? `${baseMetric}_${model}_rel`
          : `${baseMetric}_rank_${model}`;
      },
      getRankKey() {
        const { baseMetric, model } = this;
        if (!baseMetric) return null;
        if (baseMetric === "funding") return "funding_rank";
        if (baseMetric === "vulnerability") return "vulnerability_rank";
        if (baseMetric === "claims") return "claims_rank";
        return `${baseMetric}_rank_${model}`;
      },
      format(metric, value) {
        if (!metric || value == null || isNaN(value)) return "";
        if (metric.includes("funding_total"))
          return `$${d3.format(",.0f")(value)}`;
        if (metric.includes("funding_per_capita"))
          return `$${d3.format(",.0f")(value)} pp`;
        if (metric.includes("claims_paid_per_capita"))
          return `$${d3.format(",.0f")(value)} pp`;
        if (metric.includes("_rel"))
          return `${value > 0 ? "+" : ""}${Math.round(value * 100)}%`;
        if (metric.includes("rank")) return `${Math.round(value * 100)}%`;
        return d3.format(".2f")(value);
      },
    };
  }

  // helper: set which model is active across article widgets
  function setArticleModel(model, persist = true) {
    if (!model) return;
    // update metric engine
    metricEngine.model = model;
    if (!metricEngine.baseMetric) metricEngine.baseMetric = "need";

    // toggle stacked model images per container
    document.querySelectorAll(".model-switcher").forEach((container) => {
      const imgs = Array.from(container.querySelectorAll(".model-img"));
      if (!imgs.length) return;
      // find the target image for this model and the currently visible one
      const target = imgs.find((i) => i.classList.contains(`model-${model}`));
      const current = imgs.find((i) => i.classList.contains("visible"));

      // if target already visible, nothing to do
      if (target && target === current) return;

      // make the target visible first so it can fade in
      if (target) target.classList.add("visible");

      // remove visibility from other images on the next frame so the two overlap
      // Use a per-container rAF handle so different model-switcher containers
      // don't cancel each other's cleanup when toggling rapidly.
      if (container._articleImageCleanup)
        cancelAnimationFrame(container._articleImageCleanup);
      container._articleImageCleanup = requestAnimationFrame(() => {
        imgs.forEach((img) => {
          if (img !== target) img.classList.remove("visible");
        });
        container._articleImageCleanup = null;
      });
    });

    // update selector active state and sync radio inputs across any control instances
    const selectorLabels = document.querySelectorAll(".article-model-control label[data-model]");
    selectorLabels.forEach((lbl) => {
      const input = lbl.querySelector("input[type=radio]");
      if (lbl.dataset && lbl.dataset.model === model) {
        lbl.classList.add("active");
        if (input) input.checked = true;
      } else {
        lbl.classList.remove("active");
        if (input) input.checked = false;
      }
    });

    if (persist) localStorage.setItem(STORAGE_KEY, model);

    // re-render scatter if available
    if (typeof renderPlot === "function") {
      try {
        // use 'top' so article scatter shows full-bright dots (dashboard default)
        renderPlot(metricEngine.baseMetric, "top");
      } catch (e) {
        // graceful: do nothing if plots not ready
        console.warn("renderPlot failed:", e);
      }
    }
  }

  // ensure the model-switcher container keeps the right height and images overlay
  function positionModelSwitchers() {
    document.querySelectorAll(".model-switcher").forEach((container) => {
      const imgs = container.querySelectorAll(".model-img");
      if (!imgs || imgs.length === 0) return;
      const ref = imgs[0];
      // If image already has layout height, use it; otherwise estimate from natural ratio
      const rect = ref.getBoundingClientRect();
      if (rect && rect.height > 8) {
        container.style.height = rect.height + "px";
      } else if (ref.naturalWidth && ref.naturalHeight) {
        const w = container.clientWidth || ref.naturalWidth;
        const h = (ref.naturalHeight / ref.naturalWidth) * w;
        container.style.height = h + "px";
      }
      container.style.position = "relative";
      imgs.forEach((img) => {
        img.style.position = "absolute";
        img.style.top = 0;
        img.style.left = 0;
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "contain";
      });
    });
  }

  // create a non-interactive ghost of the control in the dock placeholder
  function populateDockGhost() {
    const dock = document.getElementById("article-model-dock");
    const ctrl = document.getElementById("article-model-control");
    if (!dock || !ctrl) return;
    if (dock.dataset.populated) return;
    try {
      // clone inner markup but keep inputs non-interactive
        dock.innerHTML = '<div class="article-model-control article-model-control-ghost">' + ctrl.innerHTML + "</div>";
        // sanitize duplicate ids in the ghost and make it interactive
        const clonedSelector = dock.querySelector('#article-model-selector');
        if (clonedSelector) clonedSelector.id = 'article-model-selector-dock';
    } catch (e) {
      // fallback: simple cloneNode without events
      const clone = ctrl.cloneNode(true);
      dock.appendChild(clone);
    }
    // make ghost inputs independent and interactive, and sync their checked state
    const model = metricEngine && metricEngine.model ? metricEngine.model : null;
    dock.querySelectorAll('input[type=radio]').forEach((i) => {
      // avoid native browser grouping between main control and ghost
      i.name = 'article-model-dock';
      i.disabled = false;
      i.removeAttribute('aria-hidden');
      i.tabIndex = 0;
      // ensure label reflect current model state
      const lbl = i.closest('label[data-model]');
      if (lbl) {
        if (model && lbl.dataset.model === model) {
          lbl.classList.add('active');
          i.checked = true;
        } else {
          lbl.classList.remove('active');
          i.checked = false;
        }
      }
    });
    // make dock visible to assistive tech now that it's interactive
    dock.removeAttribute('aria-hidden');
    // wire up event handlers for the dock selector so it controls the article
    const dockSelector = dock.querySelector('#article-model-selector-dock');
    if (dockSelector) wireSelector(dockSelector);
    dock.dataset.populated = "1";
  }

  // helper to wire a selector element with click/change handlers (idempotent)
  function wireSelector(selectorEl) {
    if (!selectorEl) return;
    if (selectorEl.dataset && selectorEl.dataset.wired) return;
    selectorEl.dataset.wired = "1";

    selectorEl.addEventListener('click', (ev) => {
      const lbl = ev.target.closest('label[data-model]');
      if (!lbl) return;
      const model = lbl.dataset.model;
      setArticleModel(model, true);
    });

    selectorEl.querySelectorAll && selectorEl.querySelectorAll('input[type=radio]').forEach((inp) => {
      inp.addEventListener('change', (ev) => {
        const lbl = ev.target.closest('label[data-model]');
        if (!lbl) return;
        setArticleModel(lbl.dataset.model, true);
      });
    });
  }

  // helper to find the article container used for page padding
  function getArticleElement() {
    return document.getElementById("article-content") || document.querySelector(".article");
  }

  // wire UI controls
  function wireControls() {
    const selector = document.getElementById("article-model-selector");
    if (!selector) return;
    selector.addEventListener("click", (ev) => {
      const lbl = ev.target.closest("label[data-model]");
      if (!lbl) return;
      const model = lbl.dataset.model;
      setArticleModel(model, true);
    });

    // keyboard / input support: if radio input changed
    selector.querySelectorAll("input[type=radio]").forEach((inp) => {
      inp.addEventListener("change", (ev) => {
        const lbl = ev.target.closest("label[data-model]");
        if (!lbl) return;
        setArticleModel(lbl.dataset.model, true);
      });
    });
  }

  // Sticky behavior using CSS `position: sticky` plus lightweight observers
  function initStickyModelControl() {
    const ctrl = document.getElementById("article-model-control");
    if (!ctrl) return;

    const startAnchor =
      document.getElementById("article-model-start-anchor") ||
      document.getElementById("fig-need-choropleth");
    const endAnchor = document.getElementById("article-model-end-anchor");

    // disconnect previous observers if present
    if (ctrl._stickyObservers) {
      ctrl._stickyObservers.forEach((o) => o.disconnect());
    }
    ctrl._stickyObservers = [];

    function setFloating(on) {
      if (on) {
        ctrl.classList.add("is-floating");
        // mobile padding
        if (window.innerWidth <= 720) getArticleElement()?.classList.add("has-sticky-model");
        getArticleElement()?.classList.add("has-floating-model");
      } else {
        ctrl.classList.remove("is-floating");
        getArticleElement()?.classList.remove("has-sticky-model");
        getArticleElement()?.classList.remove("has-floating-model");
      }
    }

    // Observe the start anchor: when it leaves the viewport, the control should float
    if (startAnchor) {
      const startObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              // start anchor scrolled past -> float
              setFloating(true);
              ctrl.classList.remove("is-settled");
            } else {
              setFloating(false);
              ctrl.classList.remove("is-settled");
            }
          });
        },
        { threshold: 0 },
      );
      startObs.observe(startAnchor);
      ctrl._stickyObservers.push(startObs);
    }

    // Observe the end anchor: when it intersects viewport, the control should settle
    if (endAnchor) {
      const endObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              // reached the end anchor -> settle
              setFloating(false);
              ctrl.classList.add("is-settled");
            } else {
              ctrl.classList.remove("is-settled");
            }
          });
        },
        { threshold: 0 },
      );
      endObs.observe(endAnchor);
      ctrl._stickyObservers.push(endObs);
    }
  }

  // bootstrap: load town stats (if not present) then initialize visuals
  function bootstrap() {
    const initialModel = localStorage.getItem(STORAGE_KEY) || DEFAULT_MODEL;

    // preload model images then size switchers
    const imgs = Array.from(
      document.querySelectorAll(".model-switcher .model-img"),
    );
    if (imgs.length > 0) {
      let loaded = 0;
      imgs.forEach((img) => {
        // image may already be cached/loaded
        if (img.complete) {
          loaded += 1;
        } else {
          img.addEventListener("load", () => {
            loaded += 1;
            if (loaded === imgs.length) positionModelSwitchers();
          });
          img.addEventListener("error", () => {
            loaded += 1;
            if (loaded === imgs.length) positionModelSwitchers();
          });
        }
      });
      // if all were already complete
      if (loaded === imgs.length) positionModelSwitchers();

      // re-calc on resize
      window.addEventListener("resize", () => {
        // small debounce
        clearTimeout(window._article_resize_timer);
        window._article_resize_timer = setTimeout(positionModelSwitchers, 120);
      });
    }

    wireControls();

    // load stats if necessary then render
    if (!window.statsRaw || !window.statsRaw.length) {
      if (typeof d3 !== "undefined" && d3.csv) {
        d3.csv("./static/resources/town_stats.csv").then((ts) => {
          window.statsRaw = ts;
          setArticleModel(initialModel, false);
          populateDockGhost();
          initStickyModelControl();
        });
      } else {
        // no d3 available; still set model so images/captions update
        setArticleModel(initialModel, false);
        populateDockGhost();
        initStickyModelControl();
      }
    } else {
      setArticleModel(initialModel, false);
      populateDockGhost();
      initStickyModelControl();
    }
  }

  // init when DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
