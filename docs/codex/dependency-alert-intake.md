# Dependency alert intake — 2026-09-29

This is intake, not a completed security triage or proof of exploitability.
Target revision: `1fe998b6`. Source: repository Dependabot open alerts retrieved
read-only through GitHub REST. No alerts were dismissed or changed.

14 source items are preserved individually in
`artifacts/dependency-triage/intake.json`; all identify `package-lock.json` and
transitive development dependencies. No deduplication was performed.

| Alerts       | Package locked        | Dependency route                                               | Patched version reported by source      |
| ------------ | --------------------- | -------------------------------------------------------------- | --------------------------------------- |
| 14–21, 24–25 | @xmldom/xmldom 0.9.10 | Capacitor CLI 8.4.0 → plist 3.1.1                              | 0.9.11 or 0.9.12, depending on advisory |
| 13, 27       | extract-zip 2.0.1     | Lighthouse 12.6.1 → puppeteer-core → @puppeteer/browsers       | None reported                           |
| 28, 29       | ip-address 10.4.0     | Same browser tooling → proxy-agent → socks-proxy-agent → socks | 10.5.1                                  |

Evidence: `npm ls --all --package-lock-only` for these three packages. The checked-in
index.html script list uses the application's own scripts, and does not directly
load these packages. This does not establish build/tooling safety or prove that
all indirect runtime paths are absent.

Next: resolve security policy and trace actual CLI/browser-tooling entrypoints and
untrusted input boundaries, retaining one verdict per alert. No dependency install,
update, native build, exploit test, external report or publication was performed.
Do not dismiss alerts on the basis of development scope alone.

Follow-up on2026-10-01: [bounded exposure check](dependency-alert-exposure.md)
retains the now16 open alerts, traces actual callers and proposes compatible patch
preparation. It does not claim a completed repository-wide audit or dismiss alerts.
