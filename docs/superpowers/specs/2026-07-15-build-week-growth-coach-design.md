# Build Week Growth Coach Design

## Product decision

Archery Note remains a local-first practice tool. The Build Week experience connects score, grouping, form and practice frequency inside the existing Analysis tab instead of adding another primary tab. This passes the product gates: it connects existing records, makes change visible, stays fully local, and gives a quiet reason to check after each practice.

## Architecture

- Keep schema 4 and existing backups compatible; derived insights are computed at read time.
- Add pure functions to `scripts/45-analysis-core.js` for date windows, dashboard metrics, confidence and explainable recommendations.
- Render one compact growth summary and one-to-three next-practice suggestions above the existing analysis cards.
- Extend the existing period control to 7, 30 and 90 days plus all time.
- Demo data, when added, uses explicitly prefixed IDs and can be removed without touching user records.
- Reuse the current robust grouping statistics and never invent advice when evidence thresholds are unmet.

## Safety and quality

- No cloud, analytics SDK, account, or new dependency.
- Recommendations describe observable patterns, not medical causes.
- Every derived function has deterministic regression tests; UI paths receive Playwright coverage.
- Imported strings continue to pass through normalization and escaped DOM sinks.

## Delivery slices

1. Growth metrics, confidence and recommendations.
2. Analysis dashboard/timeline UI and demo-data lifecycle.
3. Import/security/PWA/accessibility regression coverage.
4. README and Build Week submission package.
