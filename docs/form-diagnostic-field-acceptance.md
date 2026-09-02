# Form Diagnostic Field Acceptance

Repository tests and JSON export do not establish physical acceptance.

## Trusted HTTPS prerequisite

- Record the exact implementation commit and tree IDs served by the preview.
- Confirm the app reports Archery Note v84; the version alone is not proof of tree identity.
- Use an `https://` Safari origin on the physical iPhone. Do not use the local HTTP helpers for live camera capture.
- If a trusted preview pinned to the implementation tree is unavailable, stop; this checklist does not authorize deployment.

## Physical sequence

## Data preparation

- Use a dedicated test browser profile or installation.
- Export a normal practice backup before testing if existing data is present.
- Do not clear all Safari site data; that can remove local practice records.
- Enable form diagnostics explicitly and start a new `18射の診断` batch.

Use ordinary archer placement; do not optimize placement after observing the detector.

1. Record and save six real shots from 真横.
2. Record and save six real shots from やや斜め.
3. Record and save six real shots from 通常設置.

## Pass criteria

- 6/6 real shots are retained in each condition.
- Each condition has at most one false positive, removable without deleting another shot.
- No shown true shot is automatically removed.
- Every retained receipt has anchorFloor, anchorEnter, releaseSpeed, evidenceAgeMs, evidenceStrength, departDelta, and fireEvidence.
- 診断JSONを書き出す succeeds only after the app's `buildFormDiagnosticExport(...)` gate returns `ok: true`. No separate artifact validator is claimed.

## Privacy

Keep `archery-note-form-diagnostics.json` outside the repository. Do not commit JSON, video, screenshots with private paths, device details, or raw diagnostics. If the artifact is transferred to the development PC, place it temporarily at `C:\tmp\archery-note-form-diagnostics.json` and record the output of:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath 'C:\tmp\archery-note-form-diagnostics.json'
```

Record only commit/tree IDs, iOS/Safari versions without local identifiers, aggregate condition results, pass/fail, and artifact SHA-256.
