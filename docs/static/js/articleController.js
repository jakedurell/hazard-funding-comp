// ==========================================================
// Article Interactivity
//
// Coordinates interactive behavior for the Floodlines article,
// including model switching, image transitions, plot updates,
// and sticky navigation controls.
//
// Responsibilities:
// • Initialize article widgets
// • Synchronize model selection across article components
// • Crossfade model-specific figures
// • Bootstrap article plots
// • Manage sticky model controls
//
// Notes:
// • Originally AI-generated (Claude), then reviewed and adapted for
//   the project's interactive article.
// • Serves as integration ("glue") code between reusable
//   dashboard components and article-specific UI.
// ==========================================================

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

  // Update the active model across every article component.
  function setArticleModel(model, persist = true) {
    if (!model) return;
    metricEngine.model = model;
    if (!metricEngine.baseMetric) metricEngine.baseMetric = "need";

    // Crossfade model-specific images per container
    document.querySelectorAll(".model-switcher").forEach((container) => {
      const imgs = Array.from(container.querySelectorAll(".model-img"));
      if (!imgs.length) return;
      const target = imgs.find((i) => i.classList.contains(`model-${model}`));
      const current = imgs.find((i) => i.classList.contains("visible"));

      // If target already visible, nothing to do
      if (target && target === current) return;

      // Make the target visible first so it can fade in
      if (target) target.classList.add("visible");

      // Wait one animation frame so both images briefly overlap,
      // allowing the CSS transition to crossfade smoothly
      if (container._articleImageCleanup)
        cancelAnimationFrame(container._articleImageCleanup);
      container._articleImageCleanup = requestAnimationFrame(() => {
        imgs.forEach((img) => {
          if (img !== target) img.classList.remove("visible");
        });
        container._articleImageCleanup = null;
      });
    });

    // Synchronize every model selector (main and dock) to reflect the new model
    const selectorLabels = document.querySelectorAll(
      ".article-model-control label[data-model]",
    );
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

    // Re-render scatter if available
    if (typeof renderPlot === "function") {
      try {
        // Use 'top' so article scatter shows full-bright dots (dashboard default)
        renderPlot(metricEngine.baseMetric, "top");
      } catch (e) {
        console.warn("renderPlot failed:", e);
      }
    }
  }

  // Size image containers and stack model images for crossfading
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

  // Create the floating model selector by cloning the primary
  // control and wiring it independently
  function populateDockGhost() {
    const dock = document.getElementById("article-model-dock");
    const ctrl = document.getElementById("article-model-control");
    if (!dock || !ctrl) return;
    if (dock.dataset.populated) return;
    try {
      // Clone the control without copying event listeners
      dock.innerHTML =
        '<div class="article-model-control article-model-control-ghost">' +
        ctrl.innerHTML +
        "</div>";
      // Sanitize duplicate ids in the ghost and make it interactive
      const clonedSelector = dock.querySelector("#article-model-selector");
      if (clonedSelector) clonedSelector.id = "article-model-selector-dock";
    } catch (e) {
      // Fallback: simple cloneNode without events
      const clone = ctrl.cloneNode(true);
      dock.appendChild(clone);
    }
    // Give the cloned controls their own radio group
    const model =
      metricEngine && metricEngine.model ? metricEngine.model : null;
    dock.querySelectorAll("input[type=radio]").forEach((i) => {
      // Avoid native browser grouping between main control and ghost
      i.name = "article-model-dock";
      i.disabled = false;
      i.removeAttribute("aria-hidden");
      i.tabIndex = 0;
      // Ensure label reflects current active model state
      const lbl = i.closest("label[data-model]");
      if (lbl) {
        if (model && lbl.dataset.model === model) {
          lbl.classList.add("active");
          i.checked = true;
        } else {
          lbl.classList.remove("active");
          i.checked = false;
        }
      }
    });
    // Make dock visible to assistive tech now that it's interactive
    dock.removeAttribute("aria-hidden");
    // Wire event handlers for the dock selector
    const dockSelector = dock.querySelector("#article-model-selector-dock");
    if (dockSelector) wireSelector(dockSelector);
    dock.dataset.populated = "1";
  }

  // Attach model-selection handlers to a selector instance
  function wireSelector(selectorEl) {
    if (!selectorEl) return;
    if (selectorEl.dataset && selectorEl.dataset.wired) return;
    selectorEl.dataset.wired = "1";

    selectorEl.addEventListener("click", (ev) => {
      const lbl = ev.target.closest("label[data-model]");
      if (!lbl) return;
      const model = lbl.dataset.model;
      setArticleModel(model, true);
    });

    selectorEl.querySelectorAll &&
      selectorEl.querySelectorAll("input[type=radio]").forEach((inp) => {
        inp.addEventListener("change", (ev) => {
          const lbl = ev.target.closest("label[data-model]");
          if (!lbl) return;
          setArticleModel(lbl.dataset.model, true);
        });
      });
  }

  // Helper to find the article container used for page padding
  function getArticleElement() {
    return (
      document.getElementById("article-content") ||
      document.querySelector(".article")
    );
  }

  // Connect the primary article controls
  function wireControls() {
    const selector = document.getElementById("article-model-selector");
    if (!selector) return;
    selector.addEventListener("click", (ev) => {
      const lbl = ev.target.closest("label[data-model]");
      if (!lbl) return;
      const model = lbl.dataset.model;
      setArticleModel(model, true);
    });

    // Keyboard / input support: if radio input changed
    selector.querySelectorAll("input[type=radio]").forEach((inp) => {
      inp.addEventListener("change", (ev) => {
        const lbl = ev.target.closest("label[data-model]");
        if (!lbl) return;
        setArticleModel(lbl.dataset.model, true);
      });
    });
  }

  // Keep the model selector floating while the reader is
  // within the interactive map section
  function initStickyModelControl() {
    const ctrl = document.getElementById("article-model-control");
    if (!ctrl) return;
    const startAnchor =
      document.getElementById("article-model-start-anchor") ||
      document.getElementById("fig-need-choropleth");
    const endAnchor = document.getElementById("article-model-end-anchor");

    // Clean up previous handlers/observers if any
    if (ctrl._stickyObservers) {
      ctrl._stickyObservers.forEach((o) => o.disconnect());
      ctrl._stickyObservers = null;
    }
    if (ctrl._stickyHandlers) {
      window.removeEventListener("scroll", ctrl._stickyHandlers.scroll, {
        passive: true,
      });
      window.removeEventListener("resize", ctrl._stickyHandlers.resize);
      ctrl._stickyHandlers = null;
    }
    if (ctrl._stickyRAF) {
      cancelAnimationFrame(ctrl._stickyRAF);
      ctrl._stickyRAF = null;
    }

    function setFloating(on) {
      if (on) {
        ctrl.classList.add("is-floating");
        // Mobile padding
        if (window.innerWidth <= 720)
          getArticleElement()?.classList.add("has-sticky-model");
        getArticleElement()?.classList.add("has-floating-model");
      } else {
        ctrl.classList.remove("is-floating");
        getArticleElement()?.classList.remove("has-sticky-model");
        getArticleElement()?.classList.remove("has-floating-model");
      }
    }

    // Use a scroll-based rAF update to reliably detect when the viewport is
    // between the start and end anchors. This avoids odd IntersectionObserver
    // toggles on mobile address-bar show/hide and keeps the control floating
    // strictly between the two anchors.
    function updateFloating() {
      if (!startAnchor) {
        setFloating(false);
        return;
      }
      const startRect = startAnchor.getBoundingClientRect();
      const endRect = endAnchor
        ? endAnchor.getBoundingClientRect()
        : { top: Infinity, bottom: Infinity };
      // Keep the control below the fixed navigation bar
      const triggerTop = 72;
      const startPassed = startRect.top <= triggerTop;
      const endPassed = endAnchor ? endRect.top <= triggerTop : false;
      const shouldFloat = startPassed && !endPassed;

      setFloating(shouldFloat);

      if (endPassed) {
        ctrl.classList.add("is-settled");
      } else {
        ctrl.classList.remove("is-settled");
      }
    }

    const onScroll = () => {
      if (ctrl._stickyRAF) return;
      ctrl._stickyRAF = requestAnimationFrame(() => {
        updateFloating();
        ctrl._stickyRAF = null;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    ctrl._stickyHandlers = { scroll: onScroll, resize: onScroll };

    updateFloating();
  }

  // Initialize article components once the page is ready
  function bootstrap() {
    const initialModel = localStorage.getItem(STORAGE_KEY) || DEFAULT_MODEL;

    // Wait for model images before sizing the crossfade containers
    const imgs = Array.from(
      document.querySelectorAll(".model-switcher .model-img"),
    );
    if (imgs.length > 0) {
      let loaded = 0;
      imgs.forEach((img) => {
        // Image may already be cached/loaded
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
      if (loaded === imgs.length) positionModelSwitchers();

      // Recalculate image sizing after the layout changes
      window.addEventListener("resize", () => {
        clearTimeout(window._article_resize_timer);
        window._article_resize_timer = setTimeout(positionModelSwitchers, 120);
      });
    }

    wireControls();

    // Load stats if necessary then render
    if (!window.statsRaw || !window.statsRaw.length) {
      if (typeof d3 !== "undefined" && d3.csv) {
        d3.csv("./static/resources/town_stats.csv").then((ts) => {
          window.statsRaw = ts;
          setArticleModel(initialModel, false);
          populateDockGhost();
          initStickyModelControl();
        });
      } else {
        // No d3 available; still set model so images/captions update
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

  // Initialize once the document is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
