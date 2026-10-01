# WebKit offline emulation diagnosis

2026-10-01, installed Playwright1.61.1. Actual-app source pinned to42ff185 (v93).
Fresh Chromium/WebKit contexts with synthetic demo data; no user browser profile.

## Result and causal comparison

The internal error belongs to the WebKit offline-emulation path in this local
environment. A literal service-worker response with no application code or
network dependency still fails after context.setOffline(true). The same worker
responds successfully after the origin server is actually stopped.

The actual v93 app also reloads from its worker after its origin is stopped,
retaining completed sessions and the in-progress arrow. No app/SW change is needed
to address this diagnostic failure. This does not establish physical iPhone
behavior or the exact underlying WebKit implementation defect.

## Minimal fixture

Local loopback serves one HTML page and a small worker. Two worker strategies:
literal HTML Response, and network fetch with cached-index fallback. Both confirm
an active controller and cached index before disconnecting. A no-worker variant
is the negative control. Each case uses a fresh context and server.

| Worker                 | Chromium setOffline | Chromium server stopped | WebKit setOffline | WebKit server stopped |
| ---------------------- | ------------------- | ----------------------- | ----------------- | --------------------- |
| None                   | Expected failure    | Expected failure        | Expected failure  | Expected failure      |
| Literal response       | Pass                | Pass                    | Internal error    | Pass                  |
| Network→cache fallback | Pass                | Pass                    | Internal error    | Pass                  |

Observed12 cases: six worker successes, two worker failures in WebKit emulation,
four expected no-worker failures. The diagnostic exits0 because positive and
negative controls demonstrate the intended comparison; it does not report all12
offline navigations as successful.

```text
PASS: 12-case diagnostic matrix matched; WebKit emulation fails both SW cases, real origin stop succeeds, no-worker negative controls fail
```

Evidence: artifacts/webkit-offline/minimal.cjs, minimal.json and minimal.txt.
The fixture worker uses immediate activation solely to bound test setup; the
application's staged activation remains unchanged.

## Actual app with origin stopped

Serve immutable42ff185 under/archery-note/. Seed three demo sessions, activate the
worker, start practice and record one arrow. Confirm it has reached localStorage.
Stop the HTTP server and close its connections. An independent API request must
fail with ECONNREFUSED before reloading the browser page. The navigation response
must be from the Service Worker; APP_VER remains93, sessions and active practice
deep-equal their prior values, target is visible and no page errors occur.

```text
PASS chromium 320px v93 origin stopped: SW reload, 3 demo sessions and active arrow retained, target visible, no page errors
PASS chromium 375px v93 origin stopped: SW reload, 3 demo sessions and active arrow retained, target visible, no page errors
PASS webkit 320px v93 origin stopped: SW reload, 3 demo sessions and active arrow retained, target visible, no page errors
PASS webkit 375px v93 origin stopped: SW reload, 3 demo sessions and active arrow retained, target visible, no page errors
PASS: all four actual-app origin-stop cases
```

Command: `node artifacts/webkit-offline/app-origin-stopped.cjs`, exit0. Raw cases
and preconditions: app-origin-stopped.json and app-origin-stopped.txt.

## Primary-source corroboration and next action

[Playwright issue42775](https://github.com/microsoft/playwright/issues/42775),
opened2026-09-18, reports the same literal-worker/offline-emulation distinction;
the repository's triage also reproduces it. It concerns newer versions than our
installed1.61.1, so local experiments above provide the version-specific evidence.
The published report supports the classification, not an assertion that any
uninstalled version fixes it.

Keep Playwright offline emulation for Chromium checks. For WebKit offline
verification, use a stopped-origin test with a no-worker negative control; do not
disable Service Workers or weaken the data-retention assertions. No dependency
update is required by this finding. Physical iPhone UX/actual shooting remain the
next acceptance input, without requesting practice data or personal information.
