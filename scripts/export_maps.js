// Headless exporter for choropleth images using Puppeteer
// Usage:
// 1) Install puppeteer: `npm install puppeteer` (or use `npx`)
// 2) Run: `node scripts/export_maps.js`

// This script uses Puppeteer to programmatically load the map export template with different query parameters,
// wait for the map to render, and then capture a screenshot of the map element.
// The resulting images are saved to the `docs/static/images` directory with names like `choropleth_need_eal.png`.
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
  // Open a new page in the browser
  const page = await browser.newPage();

  // Match the export template container size
  const VIEW_W = 1200;
  const VIEW_H = 800;
  await page.setViewport({
    width: VIEW_W,
    height: VIEW_H,
    deviceScaleFactor: 2,
  });

  const baseFile = `file://${process.cwd()}/docs/map_export_template.html`;

  // MANUAL OVERRIDE
  // Export options: for default map view (CENTER and ZOOM) and relative mode (INCLUDE_RELATIVE)
  // Leave null to use defaults from config.js
  // --- begin: simple CLI parsing (no deps) ---
  const rawArgs = process.argv.slice(2); // e.g. ["--center=43.9,-72.7", "--zoom=8.5", "--relative=1", "--models=eal,eal_per_capita", "--bases=need,quadrant"]
  // parse args into an options object, supporting --key=value or --key value formats, with boolean flags for --key (assumes true)
  const argv = rawArgs.reduce((acc, a) => {
    if (!a.startsWith("--")) return acc;
    const [k, v] = a.includes("=") ? a.split("=", 2) : [a, "true"];
    acc[k.replace(/^--/, "")] = v;
    return acc;
  }, {});
  const CENTER = argv.center || "43.9,-72.7"; // e.g. '43.9,-72.6'
  const ZOOM = argv.zoom ? Number(argv.zoom) : 8.5; // e.g. 9
  const INCLUDE_RELATIVE = argv.relative === "1" || argv.relative === "true"; // set true to add &relative=1
  // model and choropleth base options
  const models = (argv.models || "eal,eal_per_capita").split(",");
  const bases = (argv.bases || "need,gap,quadrant").split(",");

  for (const model of models) {
    for (const base of bases) {
      // build URL: quadrant is a special overlay in the dashboard
      // conditional between special quadrant and other choropleths
      let url;
      if (base === "quadrant") {
        url = `${baseFile}?overlay=Quadrants&model=${model}&noRiver=true`;
      } else {
        url = `${baseFile}?base=${base}&model=${model}&noRiver=true`;
      }
      // add optional parameters for center, zoom, and relative mode as needed
      if (CENTER) url += `&center=${encodeURIComponent(CENTER)}`;
      if (ZOOM) url += `&zoom=${encodeURIComponent(ZOOM)}`;
      if (INCLUDE_RELATIVE) url += `&relative=1`;
      // log the URL being rendered for debugging, wait for page to load and network to be idle
      console.log(`Rendering ${base} @ ${model} → ${url}`);
      await page.goto(url, { waitUntil: "networkidle2" });

      // wait for explicit readiness flag set by map code
      try {
        await page.waitForFunction("window.__EXPORT_READY === true", {
          timeout: 60000,
        });
      } catch (e) {
        console.warn(
          "Timed out waiting for export readiness — proceeding to screenshot",
        );
      }

      // capture the map element only (crop to #map-id)
      const el = await page.$("#map-id");
      if (!el) {
        console.error("Map element not found on page:", url);
        continue;
      }
      // define output name based on model and base, with optional _rel suffix for relative mode, and save the screenshot
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

  // close the browser when done
  await browser.close();
}

// error exit handling
exportMaps().catch((err) => {
  console.error(err);
  process.exit(1);
});
