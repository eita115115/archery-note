# Form Diagnostic Field Acceptance

Repository tests and JSON export do not establish physical acceptance.

## Trusted HTTPS prerequisite

- Record the exact implementation commit and tree IDs served by the preview.
- Confirm the app reports Archery Note v84; the version alone is not proof of tree identity.
- Use an `https://` Safari origin on the physical iPhone. Do not use the local HTTP helpers for live camera capture.
- If a trusted preview pinned to the implementation tree is unavailable, stop; this checklist does not authorize deployment.

### Local candidate preview (Windows)

- First change directory to the candidate worktree root. Run these commands
  there; do not type angle brackets as PowerShell syntax:

  ```powershell
  $lanIp = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.IPAddress -notlike "169.254*" } |
    Select-Object -First 1 -ExpandProperty IPAddress
  powershell -ExecutionPolicy Bypass -File ".\tools\serve-iphone-https.ps1" -HostAddress $lanIp
  ```

  The helper itself rejects an address that is not assigned to this PC. If the
  command prints no address, connect the PC to the same private Wi-Fi as the
  iPhone and run it again.

- Use the printed `.cer` path to install the temporary certificate on the iPhone, then enable full trust under Settings > General > About > Certificate Trust Settings.
- Open the printed `https://...:8743/` URL in the iPhone's Safari address bar.
  Do not paste the URL into PowerShell; PowerShell treats it as a command.
  Binding to an explicit LAN IPv4 keeps the preview off unrelated interfaces.
- Use a dedicated test profile, keep production data out of the preview, and stop the server after the checklist. The helper removes its temporary certificate and private key on exit.

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

On Windows PowerShell, do not type the file path by itself (PowerShell treats
that as a command). Locate the browser download, confirm it exists, and copy
it with these commands instead:

```powershell
$downloadPath = Join-Path $env:USERPROFILE "Downloads\archery-note-form-diagnostics.json"
if (-not (Test-Path -LiteralPath $downloadPath -PathType Leaf)) {
  throw "診断JSONが見つかりません: $downloadPath"
}
New-Item -ItemType Directory -Path "C:\tmp" -Force | Out-Null
Copy-Item -LiteralPath $downloadPath -Destination "C:\tmp\archery-note-form-diagnostics.json"
```

If the browser saved the file under a different name, inspect only the
Downloads folder and choose the file whose name is
`archery-note-form-diagnostics.json`:

```powershell
Get-ChildItem -LiteralPath (Join-Path $env:USERPROFILE "Downloads") -Filter "archery-note-form-diagnostics*.json" -File |
  Select-Object Name, FullName, Length, LastWriteTime
```

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath 'C:\tmp\archery-note-form-diagnostics.json'
```

Before reporting the field result, run the bounded artifact checker from the
candidate worktree. It prints only the schema, 3×6 aggregate counts, byte
length, and SHA-256; it never prints receipt details or private source data:

```powershell
node tools/inspect-form-diagnostic-json.js 'C:\tmp\archery-note-form-diagnostics.json'
```

The checker rejects a normal schema-5 backup, unknown keys, incomplete runs,
missing fire fields, invalid fire ranges, and files over 65536 UTF-8 bytes.

Record only commit/tree IDs, iOS/Safari versions without local identifiers, aggregate condition results, pass/fail, and artifact SHA-256.
