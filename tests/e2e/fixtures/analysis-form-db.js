function analysisFormDb(now = new Date()) {
  const date = (ago) => {
    const d = new Date(now);
    d.setDate(d.getDate() - ago);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const specs = [
    [0, "a", 30],
    [0, "b", 18],
    [1, "a", 30],
    [6, "a", 30],
    [7, "a", 30],
    [29, "a", 30],
    [30, "b", 18],
    [89, "a", 30],
    [90, "a", 30],
    [0, "a", null],
    [1, "b", null],
    [0, null, null],
    [2, "a", 30],
    [0, "a", 30],
    [0, null, 18],
  ];
  const sessions = specs.flatMap(([ago, setup, dist], i) =>
    dist == null
      ? []
      : [
          {
            id: `form-session-${i}`,
            date: date(i === 13 ? 90 : ago),
            setupId: setup,
            dist,
            round: "free",
            faceD: 40,
            faceType: "single",
            perEnd: 3,
            ends: [
              [
                { x: 1, y: 0, s: i % 2 ? 7 : 9 },
                { x: 2, y: 0, s: 9 },
                { x: 3, y: 0, s: 8 },
              ],
            ],
          },
        ],
  );
  return {
    schema: 5,
    settings: {
      onboardingSeen: true,
      launchCount: 10,
      activeGuideSeen: true,
      formTrackingEnabled: true,
      theme: "light",
      gamification: { enabled: false },
    },
    setups: [
      { id: "a", name: "合成の屋外用具" },
      { id: "b", name: "合成の室内用具" },
    ],
    sessions,
    sightMarks: [],
    active: null,
    customRounds: [],
    trash: [],
    formAnalyses: specs.map(([ago, setup, dist], i) => ({
      id: `form-${i}`,
      date: i === 11 || i === 12 ? "" : date(ago),
      ts: i === 11 ? 0 : new Date(date(ago) + "T12:00:00").getTime() + i * 1000,
      sessionId: dist != null ? `form-session-${i}` : i === 10 ? "missing-session" : null,
      setupId: setup,
      shots: 3,
      modelVer: "synthetic-only",
      features: [0, 1, 2].map((n) => ({
        angles: { bowArm: 150 + i, drawArm: 145 - i / 2 },
        phase: { anchorMs: 1500 + i * 10 },
        anchorNorm: 0.1 + n * 0.01,
        release: { stable: i % 2 === 0 },
      })),
    })),
  };
}
module.exports = { analysisFormDb };
