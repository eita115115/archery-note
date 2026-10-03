# AN-057 — Compact distribution Pages release

## Scope and plan

Standing human approval covers scoped release and Pages configuration; no money/private practice data. Repository is public, Pages currently `legacy` from `main` `/`, remote main `29979e261e93ffdfcdce224293283764e5641b7b`. Previous goal turn AN-056 made progress by implementing and validating actual compact distribution. Publish it using the existing CI validation job, then upload its generated artifact and deploy only after successful validation. Pull requests continue checks without deployment. Pages publication is serialized; worker activation/cache strategy and editable source layout remain unchanged.

Use `configure-pages@v5`, `upload-pages-artifact@v4`, `deploy-pages@v4` with deployment `needs:validate`, Pages/OIDC permissions and `github-pages` environment, following [GitHub's official custom workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). Enable the existing site's workflow build type through the [Pages API](https://docs.github.com/en/rest/pages/pages#update-information-about-a-github-pages-site) only after local candidate/review checks, immediately before the approved push. Retain old live v98 until generated deployment succeeds; if deployment fails, inspect/fix the same source run or restore the recorded prior Pages source without changing user data.

Validate current generated package's 25 app assets (14 compact JS, seven core files, four unchanged lazy pose assets), version alignment, full checks/lint/format/E2E and actual v98→candidate worker/update/offline with synthetic records. After publishing, inspect exact-source Linux CI/Pages, download the **actual uploaded Linux artifact** for strict public byte comparison, and exercise fresh 375px recording/correction/end/settings swipe/offline retention. Local Windows text may have CRLF differences; the uploaded artifact is the public parity source of truth. No real-device/INP speed promise follows from local AN-056 measurements.

## Validation and publication

Local candidate `6ea08744cbef6f9fa51cb487a22579f3e1bd2454`: `check:all`, lint and format passed; actual generated distribution E2E `130 passed (1.7m)`. Version markers are aligned at 99. Four normal-motion/touch Chromium and WebKit cases (320/375px) used the real v98 worker and actual v99 generated files, with no test-only version substitutions. All passed clickable update, activated v99 controller/cache, six-arrow correction/end/next arrow, unchanged five synthetic sessions/trend, stopped-origin offline reload, and zero page errors. All 25 candidate asset hashes match the checked build; shared dependency lock remains unchanged. Read-only review found no P1/P2.

On 2026-10-03, verified remote main ancestry from `29979e261e93ffdfcdce224293283764e5641b7b`, changed Pages `build_type` from `legacy` to `workflow` (HTTPS/domain unchanged), then ordinary-pushed `6ea08744cbef6f9fa51cb487a22579f3e1bd2454` to main. Exact-source CI [37131360394](https://github.com/eita115115/archery-note/actions/runs/37131360394) succeeded: Ubuntu, Node22.23.3, clean npm ci with zero vulnerabilities, all checks/lint/format, `130 passed (2.7m)`, and dependent Pages deployment reported success at 14:59:23 UTC. No root/shared dependency installation or user practice data was used.

Downloaded actual uploaded Linux artifact11276573236, verified 26 regular files/no links, safely extracted within the owned release directory. All **25 public app assets are byte-identical** to that artifact. Linux LF-source JS gzip is195178→138825 bytes (56353 bytes/28.87% reduction); earlier Windows CRLF input gives195931→138825 (29.15%). Both are transport-size comparisons, not a real-phone latency/INP guarantee.

Fresh public375px mobile Chromium passed five synthetic histories, grouped subtotal19, named analysis filters and retained focus, six-arrow correction/end/next arrow, visible end action/toast, settings dismissal by actual CDP touch swipe, unchanged scale after two-finger pinch, real browser-offline uncached-fetch rejection and worker-served reload with histories plus six completed arrows/one current arrow retained, zero page errors. Saved screenshots were inspected. This proves fresh-v99 behavior, not an old-profile update.

**Update acceptance failed and remains open.** The held actual public-v98 profile showed the banner and navigated to `appv`, then timed out waiting30s for `APP_VER===99`. The harness closed its owned context afterward, so the original failure's actual APP_VER/worker/cache/loaded-body values are unavailable; that public transition is not reported as passed or recovered. No data-loss evidence was collected, but its post-update checks were not reached. Raw failure is retained in `live-update.txt`.

A separate isolated same-URL real-worker reproduction with `Cache-Control:public,max-age=600` confirmed an APP98 page with **activated v99 worker/controller and v99 cache containing APP98** after clicking update. Changing only Chromium HTTP-cache disabling allowed APP99; later synthetic/offline checks passed in this diagnostic condition. This supports a stale HTTP-asset mechanism consistent with the public failure; it does not prove the original profile's unobserved state or meet normal-update acceptance. Existing `freshReload` changes only the document query, and worker `addAll` uses default HTTP caching. The mechanism predates this release; no corrective source/runtime change was made in this run. The initial local four-case tests used no-store and did not cover a warm600s HTTP cache. An added diagnostic-helper syntax error was corrected before the confirmed probe; no application file was involved.

Independent read-only follow-up review requires retaining the original failure and holding AN-057 overall acceptance. Next bounded AN-058: add a normal-cache regression and fix release asset freshness/worker precaching without deleting practice data or changing activation flags; verify a warm98/99→new candidate update and offline code/data consistency before publishing its aligned next version. AN-057 stays in-progress/false until normal public update evidence passes. Real iPhone/VoiceOver/keyboard/large saved data/INP and pose inference remain unverified.

Raw local evidence: `artifacts/compact-js/release-{check-all,lint,format,e2e,workflow}.txt`, `artifacts/release-v99/transition-observed.json`, `candidate.json`, `pages-before.json`, `pages-after.json`, `ci-linux.txt`, `live-parity.json`, `fresh-deployed.json`, `fresh-deployed.txt`, `cache-diagnosis.json`, `cache-diagnosis-confirmed.txt`. These ignored local artifacts contain only generated fixtures and public assets. Exact inspected command output:

```text
Version alignment checks OK
Distribution checks passed:14 structures/names/order/source/regeneration; gzip JS 195178→138825 bytes; cross-script fixtures
All matched files use Prettier code style!
130 passed (2.7m)
Reported success!
PASS: all 25 public v99 assets byte-identical to actual Linux Pages artifact (14 compact JS, 7 core, 4 lazy pose assets)
PASS: deployed touch swipe dismisses settings and retains sessions
PASS: deployed v99, actual checked compact distribution, round collapse/expansion and score distribution, synthetic history/start, offline reload, data retention, no page errors
page.waitForFunction: Timeout 30000ms exceeded.
PASS: max-age600 reproduces stale APP98 after banner; disabling only HTTP cache permits APP99
```
