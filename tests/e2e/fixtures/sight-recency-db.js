const { sightLedgerDb } = require("./sight-ledger-db");
function sightRecencyDb() {
  const data = sightLedgerDb(),
    date = "2026-10-13";
  const mark = (id, v, hour, setupId = "a", dist = 30) => ({
    id,
    setupId,
    dist,
    v,
    h: "0.4",
    date,
    ts: new Date(`${date}T${hour}:00:00+09:00`).getTime(),
    note: "合成・記録時刻の回帰",
  });
  data.sightMarks = [
    mark("newer", "90", "11"),
    mark("older", "80", "10"),
    mark("distance", "40", "12", "a", 18),
    mark("setup", "900", "12", "b"),
  ];
  return data;
}
module.exports = { sightRecencyDb };
