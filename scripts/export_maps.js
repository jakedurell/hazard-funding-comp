// ==========================================================
// Map Image Export
//
// Uses Puppeteer to generate static map images for the
// Floodlines article, README, and other project documentation.
//
// Responsibilities:
// • Launch a headless browser
// • Load the map export template
// • Apply export parameters (overlay, model, view, etc.)
// • Wait for rendering to complete
// • Capture and save map images to `docs/static/images`
//
// Usage:
//   node scripts/export_maps.js
//
// Optional CLI arguments:
//   --center=43.9,-72.7
//   --zoom=8.5
//   --relative=true
//   --models=eal,eal_per_capita
//   --bases=need,gap,quadrant
//
// Notes:
// • Originally AI-generated (Claude), then reviewed and
//   documented for this project.
// • Intended as a build utility rather than application code.
// ==========================================================

const puppeteer = require("puppeteer");
const path = require("path");

async function exportMaps() {
  // Launch headless browser with necessary flags for local file access and no sandbox (required in some environments)
  const browser = await puppeteer.launch({
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--allow-file-access-from-files",
    ],
  });
  const page = await browser.newPage();

  // Configure the export viewport to match the article layout
  const VIEW_W = 1200;
  const VIEW_H = 800;
  await page.setViewport({
    width: VIEW_W,
    height: VIEW_H,
    deviceScaleFactor: 2,
  });

  const baseFile = `file://${process.cwd()}/docs/map_export_template.html`;

  // Parse optional command-line overrides for the default export view, models, and overlay types
  // e.g. ["--center=43.9,-72.7", "--zoom=8.5", "--relative=1", "--models=eal,eal_per_capita", "--bases=need,quadrant"]
  const rawArgs = process.argv.slice(2);
  const argv = rawArgs.reduce((acc, a) => {
    if (!a.startsWith("--")) return acc;
    const [k, v] = a.includes("=") ? a.split("=", 2) : [a, "true"];
    acc[k.replace(/^--/, "")] = v;
    return acc;
  }, {});
  const CENTER = argv.center || "43.9,-72.7";
  const ZOOM = argv.zoom ? Number(argv.zoom) : 8.5;
  const INCLUDE_RELATIVE = argv.relative === "1" || argv.relative === "true";
  const models = (argv.models || "eal,eal_per_capita").split(",");
  const bases = (argv.bases || "need,gap,quadrant").split(",");

  // Export every requested model/overlay combination.
  for (const model of models) {
    for (const base of bases) {
      let url;
      if (base === "quadrant") {
        url = `${baseFile}?overlay=Quadrants&model=${model}&noRiver=true`;
      } else {
        url = `${baseFile}?base=${base}&model=${model}&noRiver=true`;
      }
      if (CENTER) url += `&center=${encodeURIComponent(CENTER)}`;
      if (ZOOM) url += `&zoom=${encodeURIComponent(ZOOM)}`;
      if (INCLUDE_RELATIVE) url += `&relative=1`;
      // Log the URL being rendered for debugging, wait for page to load and network to be idle
      console.log(`Rendering ${base} @ ${model} → ${url}`);
      await page.goto(url, { waitUntil: "networkidle2" });

      // Wait for the map to finish rendering before capturing the screenshot
      try {
        await page.waitForFunction("window.__EXPORT_READY === true", {
          timeout: 60000,
        });
      } catch (e) {
        // Fall back if the readiness flag times out
        console.warn(
          "Timed out waiting for export readiness — proceeding to screenshot",
        );
      }

      // Capture only the Leaflet map container and save it using a descriptive filename
      const el = await page.$("#map-id");
      if (!el) {
        console.error("Map element not found on page:", url);
        continue;
      }
      const box = await el.boundingBox();
      const relSuffix = INCLUDE_RELATIVE ? "_rel" : "";
      const outName = `docs/static/images/choropleth_${base}_${model}${relSuffix}.png`;
      await page.screenshot({
        path: outName,
        clip: {
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
        },
      });
      console.log(`Wrote ${outName}`);
    }
  }

  // Clean up the browser session
  await browser.close();
}

// Error exit handling
exportMaps().catch((err) => {
  console.error(err);
  process.exit(1);
});
