const { sightRecencyDb } = require("./sight-recency-db");
function sightZeroDb() {
  const data = sightRecencyDb();
  data.sightMarks[0].v = 0;
  data.sightMarks[0].h = 0;
  return data;
}
module.exports = { sightZeroDb };
