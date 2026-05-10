// Description: Main JavaScript file for the VT Floodlines project

// globals for data
let towns = {};
let statsRaw = [];
let statsByTown = {};
let riverCorridors = {};

// fetch data and geojson, clean data, populate scrape date, create map
Promise.all([
  fetch("./static/resources/town_boundaries.geojson").then((response) =>
    response.json(),
  ),
  d3.csv("./static/resources/town_stats.csv"),
  fetch("./static/resources/river_corridors_tier1.geojson").then((response) =>
    response.json(),
  ),
]).then(([tb, ts, rc]) => {
  towns = tb;
  riverCorridors = rc;
  statsRaw = ts;

  // convert town stats to a javascript object for easy lookup
  statsRaw.forEach((row) => {
    statsByTown[row.town_name] = row;
  });

  // initialize rankings data
  initializeRankings(statsRaw);
  wireRankingJumps();

  // create the map
  createMap();
});
