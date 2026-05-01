// Description: Main JavaScript file for the VT Floodlines project

// globals for data
let towns = {};
let statsByTown = {};

// fetch data and geojson, clean data, populate scrape date, create map
Promise.all([
  fetch("./static/resources/town_boundaries.geojson").then((response) =>
    response.json(),
  ),
  d3.csv("./static/resources/town_stats.csv"),
]).then(([tb, ts]) => {
  towns = tb;
  statsByTown = ts;

  // convert town stats to a javascript object for easy lookup
  statsByTown.forEach((row) => {
    statsByTown[row.town_name] = row;
  });

  // initialize rankings data
  initializeRankings(statsByTown);

  // create the map
  createMap();
});
