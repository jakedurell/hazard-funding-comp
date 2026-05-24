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
        if (metric.includes("funding_total")) return `$${d3.format(",.0f")(value)}`;
        if (metric.includes("funding_per_capita")) return `$${d3.format(",.0f")(value)} pp`;
        if (metric.includes("claims_paid_per_capita")) return `$${d3.format(",.0f")(value)} pp`;
        if (metric.includes("_rel")) return `${value > 0 ? "+" : ""}${Math.round(value * 100)}%`;
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

    // toggle stacked model images
    document.querySelectorAll(".model-switcher .model-img").forEach((img) => {
      if (img.classList.contains(`model-${model}`)) img.classList.add("visible");
      else img.classList.remove("visible");
    });

    // update selector active state
    document.querySelectorAll("#article-model-selector label").forEach((lbl) => {
      if (lbl.dataset && lbl.dataset.model === model) lbl.classList.add("active");
      else lbl.classList.remove("active");
    });

    // update small mini label for condensed sticky state
    const mini = document.getElementById('article-mini-model');
    if (mini) {
      const label = (window.modelKeyToLabel && window.modelKeyToLabel[model])
        ? window.modelKeyToLabel[model]
        : model === 'eal_per_capita'
        ? 'Risk per Person'
        : model === 'eal'
        ? 'Total Risk'
        : model === 'nri'
        ? 'FEMA Risk Index'
        : model;
      mini.textContent = `Model: ${label}`;
    }

    if (persist) localStorage.setItem(STORAGE_KEY, model);

    // re-render scatter if available
    if (typeof renderPlot === "function") {
      try {
        // use 'top' so article scatter shows full-bright dots (dashboard default)
        renderPlot(metricEngine.baseMetric, 'top');
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

  // Sticky/condensed behavior for the in-article model control
  const _stickyControl = {
    ctrl: null,
    triggerY: 0,
    navHeight: 0,
    ticking: false,
  };

  const STICKY_THRESHOLD = 120; // px after sentinel before sticky engages

  function initStickyModelControl() {
    const ctrl = document.getElementById("article-model-control");
    if (!ctrl) return;
    _stickyControl.ctrl = ctrl;
    const sentinel = document.getElementById("fig-need-choropleth");
    const navbar = document.querySelector('.navbar-fixed-top') || document.querySelector('.navbar');

    function computeOffsets() {
      // ensure image sizing/layout settled
      try {
        positionModelSwitchers();
      } catch (e) {}

      _stickyControl.navHeight = navbar ? navbar.getBoundingClientRect().height : 0;

      if (sentinel) {
        const sRect = sentinel.getBoundingClientRect();
        _stickyControl.triggerY = sRect.top + (window.scrollY || window.pageYOffset) + sRect.height + STICKY_THRESHOLD;
      } else {
        const rect = ctrl.getBoundingClientRect();
        _stickyControl.triggerY = rect.top + (window.scrollY || window.pageYOffset) + STICKY_THRESHOLD;
      }
    }

    computeOffsets();

    window.addEventListener('resize', () => {
      clearTimeout(window._article_sticky_resize);
      window._article_sticky_resize = setTimeout(() => {
        computeOffsets();
        updateStickyState();
      }, 160);
    });

    window.addEventListener('scroll', () => {
      if (!_stickyControl.ticking) {
        window.requestAnimationFrame(() => {
          updateStickyState();
          _stickyControl.ticking = false;
        });
        _stickyControl.ticking = true;
      }
    });

    // pointer and focus interactions
    ctrl.addEventListener('pointerenter', () => ctrl.classList.remove('condensed'));
    ctrl.addEventListener('pointerleave', () => {
      if (ctrl.classList.contains('sticky') && window.innerWidth > 720) ctrl.classList.add('condensed');
    });
    ctrl.addEventListener('focusin', () => ctrl.classList.remove('condensed'));
    ctrl.addEventListener('focusout', () => {
      if (ctrl.classList.contains('sticky') && window.innerWidth > 720) ctrl.classList.add('condensed');
    });

    // touch-friendly: expand immediately on pointerdown (works for touch and mouse)
    ctrl.addEventListener('pointerdown', () => {
      ctrl.classList.remove('condensed');
      const mini = document.getElementById('article-mini-model');
      if (mini) mini.setAttribute('aria-hidden', 'true');
    });

    // initial state
    updateStickyState();
  }

  function updateStickyState() {
    const ctrl = _stickyControl.ctrl;
    if (!ctrl) return;
    const scrollY = window.scrollY || window.pageYOffset;
    const triggerY = _stickyControl.triggerY || 0;
    if (scrollY > triggerY) {
      // ensure the sticky class is present
      if (!ctrl.classList.contains('sticky')) ctrl.classList.add('sticky');

      // On narrow screens we center the control using left:50% + translateX(-50%),
      // on wider screens anchor to the right. This prevents the translate from
      // shifting a right-anchored element half offscreen.
      if (window.innerWidth > 720) {
        ctrl.classList.add('condensed');
        ctrl.style.left = 'auto';
        ctrl.style.right = '18px';
        ctrl.style.transform = '';
        ctrl.style.width = '';
      } else {
        ctrl.classList.remove('condensed');
        ctrl.style.left = '50%';
        ctrl.style.right = 'auto';
        ctrl.style.transform = 'translateX(-50%)';
        ctrl.style.width = 'calc(100% - 40px)';
      }

      // compute a safe top so the control is visible and not offscreen
      const ctrlHeight = ctrl.offsetHeight || ctrl.getBoundingClientRect().height || 48;
      const desiredTop = Math.max(8, (_stickyControl.navHeight || 0) + 8);
      const maxTop = Math.max(8, window.innerHeight - ctrlHeight - 8);
      const topPx = Math.min(desiredTop, maxTop);
      ctrl.style.top = topPx + 'px';
    } else {
      if (ctrl.classList.contains('sticky')) {
        ctrl.classList.remove('sticky', 'condensed');
        ctrl.style.top = '';
        ctrl.style.right = '';
        ctrl.style.left = '';
        ctrl.style.transform = '';
        ctrl.style.width = '';
      }
    }

    // update mini label aria state for accessibility
    const mini = document.getElementById('article-mini-model');
    if (mini) mini.setAttribute('aria-hidden', ctrl.classList.contains('condensed') ? 'false' : 'true');
  }

  // bootstrap: load town stats (if not present) then initialize visuals
  function bootstrap() {
    const initialModel = localStorage.getItem(STORAGE_KEY) || DEFAULT_MODEL;

    // preload model images then size switchers
    const imgs = Array.from(document.querySelectorAll(".model-switcher .model-img"));
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
          initStickyModelControl();
        });
      } else {
        // no d3 available; still set model so images/captions update
        setArticleModel(initialModel, false);
        initStickyModelControl();
      }
    } else {
      setArticleModel(initialModel, false);
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
