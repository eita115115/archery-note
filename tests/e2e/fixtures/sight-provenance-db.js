const { sightRecencyDb } = require("./sight-recency-db");
function sightProvenanceDb() {
  const data = sightRecencyDb();
  const mark = (id, dist, v, date, hour, setupId = "a") => ({
    id,
    setupId,
    dist,
    v,
    h: "0.4",
    date,
    ts: new Date(`${date}T${hour}:00:00+09:00`).getTime(),
    note: "合成・予測の採用記録",
  });
  data.sightMarks = [
    mark("blank-new", 30, "", "2026-10-14", "12"),
    mark("measured30", 30, "80", "2026-10-13", "11"),
    mark("measured18", 18, "40", "2026-10-12", "10"),
    mark("other-setup", 30, "900", "2026-10-14", "13", "b"),
  ];
  return data;
}
module.exports = { sightProvenanceDb };
