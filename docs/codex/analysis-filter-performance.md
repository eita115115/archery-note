# Analysis filter performance evidence — AN-043

Immutable comparison: published v94/e1ec1fe6747e03bac11b41baeba55c1668ad51d5
and v95/7039fcea9e84806b2c6aa852b9a90aa1e438e295. Runtime unchanged by this audit.

## Method and result

An owned local HTTP server reads both revisions directly from Git. Fresh
Chromium/WebKit contexts use375×812, dark mode, reduced motion and blocked workers.
Fixtures contain100/1000/5000 sessions of36 arrows,180 repeating dates and fake
equipment; Chromium1000 also uses4× CPU throttling. Geometry is single122cm faces
near the centre, scored with the existing scoreAt function. No private record is
read. Identical input hashes are checked for each revision pair.

Six actions cover distance70/all, equipmentA/all and period7d/all. Each context
has one warm cycle then five measured samples per action:14 contexts,420 samples.
The table gives median synchronous handler plus forced layout time in milliseconds.
Two animation frames precede focus/visibility assertions; that interval is not INP
or a verified paint time. Revision order alternates by scenario, without paired
interleaving. The event dispatch is artificial, after explicitly focusing the control.

| Engine   | Sessions | CPU rate | v94 distance70 | v95 distance70 | v94 all distances | v95 all distances |
| -------- | -------- | -------- | -------------- | -------------- | ----------------- | ----------------- |
| Chromium | 100      | 1        | 6.6            | 7.3            | 8.9               | 9.5               |
| Chromium | 1000     | 1        | 27.1           | 28.3           | 41.4              | 42.1              |
| Chromium | 5000     | 1        | 106.8          | 106.2          | 174.4             | 172.8             |
| Chromium | 1000     | 4        | 131.8          | 143.2          | 198.0             | 204.7             |
| WebKit   | 100      | 1        | 16             | 16             | 20                | 21                |
| WebKit   | 1000     | 1        | 47             | 46             | 67                | 68                |
| WebKit   | 5000     | 1        | 163            | 172            | 286               | 295               |

These results establish substantial work with large histories, not a speedup from
the focus correction. Every action checks independently expected session/arrow
counts. Candidate controls retain focus and remain below the visible header and
above navigation. Both revisions retain identical in-memory practice state and
the persisted small demo; overflow and page errors are zero.

```text
PASS: identical synthetic inputs across revisions; expected filtered counts; candidate focus/visible bounds; memory and persisted demo unchanged; overflow/page errors0
```

Large fixtures exist only in memory: the5000-session JSON is6778175 bytes and
was deliberately not saved. This is not a5000-record persistence test. Separate
cold fixture renders have one sample per condition, not actual application startup.
Separate instrumented profiles are single, inclusive, non-additive samples.
robustStats calls are zero after warming; cache signatures and rows are still read.
Layout inside focus reveal can include preceding rendering work, so its inclusive
time must not be attributed entirely to the reveal function.

## Next bounded improvement and limits

scoreTrendCard calls historySessionRows for every filtered session, then discards
everything except the first eight nonempty records. Restricting this card's arrow
aggregation to those eight is a grounded next task. Empty records must still be
skipped; simply slicing the input to eight changes behavior. Preserve exact HTML,
score coercion and input immutability, and verify bounded arrow reads before timing.
This is not proven to be the largest bottleneck, and its benefit is not yet measured.

Independent read-only review recomputed medians from all420 samples, confirmed
paired hashes/counts/invariance and found no actionable issue. It did not rerun
the harness. Actual iPhone, INP, normal-motion performance, mixed face geometry,
network startup and large real-storage behavior remain outside this measurement.

Raw artifacts: artifacts/analysis-filter-performance/measure-final.cjs,
results.json, summary.json and output.txt. The first seed harness incorrectly
called showView on an already selected analysis view; its cold field was invalid.
The corrected harness explicitly renders the fixture and reran all14 contexts.
Initial artifacts are preserved and not used as final evidence. The final console
caption said all/70 although values were ordered70/all; named JSON fields were
authoritative. Only the reproduction caption was subsequently corrected.

No app changes, installations, telemetry, paid service or personal data use.
