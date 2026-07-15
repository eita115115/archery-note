# Archery Note

**One line:** A private, offline-first practice coach that turns archery records into the next explainable practice action.

Archers often collect scores without learning what changed. Archery Note is for university club archers and beginners who record at ranges with unreliable connectivity and do not want practice data uploaded. It combines tap-based scoring, robust grouping analysis, form records, equipment, sight notes, a growth timeline, and one-to-three rule-based next-practice suggestions.

Unlike a score ledger, it compares each athlete with their own prior practices. Every suggestion shows the recorded reason; low sample counts reduce confidence instead of producing a mystery score. All processing and records stay on the device. The PWA uses vanilla JavaScript, HTML/CSS, local storage with snapshots and JSON/CSV portability, a Service Worker, Node contract checks, and Playwright E2E tests.

GPT-5.6 in Codex was used to inspect the existing architecture and history, design pure analysis functions, run red-green tests, integrate the mobile UI, exercise browser flows, review privacy and release boundaries, and prepare factual submission material. The human product decisions were to keep recording simple, make every recommendation explainable, and retain fully local processing. This Build Week iteration adds fixed 7/30/90-day views, the growth dashboard, evidence-bearing practice suggestions, isolated removable demo data, first-load performance improvements, and stronger release checks. Future work includes broader longitudinal form metrics and human-tested club workflows, still without cloud data collection.
