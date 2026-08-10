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
  iPhone and run it again. The helper also prints `Preview Git commit:` and
  `Preview Git tree:` before the URL; record both values with the field result
  so the evidence is tied to the exact served tree.

- Use the printed `.cer` path to install the temporary certificate on the iPhone, then enable full trust under Settings > General > About > Certificate Trust Settings.
- If locating the certificate on Windows is inconvenient, append
  `-OpenCertificate` to the helper command. This opens the `.cer` on the PC;
  transfer that file to the iPhone (for example with AirDrop, iCloud Drive, or
  Files) before installing and trusting it. The switch does not install or
  trust the certificate automatically.
- The helper preflights the requested port before creating a certificate. If a
  previous preview is still listening, it stops with an explicit `Port 8743 is
already in use` error (including listener PIDs when Windows exposes them).
  Stop that preview or choose a deliberate alternate port; do not create a new
  certificate while the old server is still running. The check uses
  `Get-NetTCPConnection` when available and a `TcpClient` fallback otherwise.
- Open the printed `https://...:8743/` URL in the iPhone's Safari address bar.
  Do not paste the URL into PowerShell; PowerShell treats it as a command.
  Binding to an explicit LAN IPv4 keeps the preview off unrelated interfaces.
- If Safari reports that the server cannot be reached, keep the server running
  and run this on the PC using the same address and port:

  ```powershell
  Test-NetConnection -ComputerName $lanIp -Port 8743
  ```

  `TcpTestSucceeded: False` means the PC/network firewall or Wi‑Fi isolation is
  blocking the port; do not change the app or certificate until that is fixed.
  If the helper warns that the Windows profile is `Public`, use a trusted
  `Private` Wi‑Fi profile or an explicitly approved firewall rule. A successful
  TCP test followed by a Safari warning means the certificate was not installed
  or full trust was not enabled yet.

  If the helper says `Get-NetIPAddress` is unavailable, it has already switched
  to a .NET network-interface fallback; continue with the printed address.

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

## Latest reported run (not accepted)

The user-reported run served from tree `8c399209` produced the following
aggregate result:

| condition | retained | false positives | automatic deletion |
| --------- | -------: | --------------: | -----------------: |
| 真横      |      3/6 |               0 |                  0 |
| やや斜め  |      0/6 |               0 |                  0 |
| 通常設置  |      3/6 |               0 |                  0 |

The export action reported success, but the diagnostic JSON could not be
located afterward, so no artifact path or SHA-256 was available. This run is
therefore a failed/incomplete acceptance result for the older served tree, not
evidence that the current candidate passes. Do not change detector thresholds
from this result alone; repeat the sequence on the current candidate and run
the bounded artifact checker before drawing a conclusion.

## Current artifact (provisional)

The current external diagnostic artifact passes the bounded checker with
schema 1, app version 84, matrix `field-3x6`, 9,869 UTF-8 bytes, and SHA-256
`7452e0bdf3ad87e4735447e024e791da5ef123f2c85642f685ccc9b871c82114`.

Privacy-safe aggregate from the artifact:

| condition    | retained | receipt count | auto-canceled | unresolved |
| ------------ | -------: | ------------: | ------------: | ---------: |
| side         |      6/6 |             8 |             2 |          0 |
| oblique      |      6/6 |             6 |             0 |          0 |
| normal_range |      6/6 |             6 |             0 |          0 |

All retained receipts are `confirmed`; the artifact contains no unresolved
receipt. This is still provisional until the operator confirms that the
preview printed candidate commit `0160574ae396a024f22660d8b78c219e516a968c`
and tree `f7ae775edc37ed9dbcb535f6a5f69fec8cda1637`, and that the two side
auto-canceled receipts did not remove a real shown shot. The JSON remains
outside the repository.

## Pass criteria

- 6/6 real shots are retained in each condition.
- Each condition has at most one false positive, removable without deleting another shot.
- No shown true shot is automatically removed.
- Every retained receipt has anchorFloor, anchorEnter, releaseSpeed, evidenceAgeMs, evidenceStrength, departDelta, and fireEvidence.
- 診断JSONを書き出す succeeds only after the app's
  `buildFormDiagnosticExport(...)` gate returns `ok: true`.
- On iPhone Web Share, a `診断JSONを共有しました` toast means the file was
  handed to the share sheet, not that a file already exists on the development
  PC. Choose `ファイルに保存` (or another explicit file destination) in the
  share sheet, then verify the saved artifact before reporting acceptance.
- If the share sheet is inconvenient, choose `端末に直接保存` in the same
  settings section. This uses the browser download path and still produces the
  exact `archery-note-form-diagnostics.json` artifact for the checker.
- The separate offline checker below is authoritative for the transferred
  file. A share-sheet success without a saved file is not acceptance evidence.

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

If the browser saved exactly one matching artifact in the current user's
`Downloads` folder, the checker can locate it without copying or printing its
full path. It scans only `%USERPROFILE%\Downloads` and refuses to guess when
there are zero or multiple candidates:

```powershell
node tools/inspect-form-diagnostic-json.js --from-downloads
```

For a multiple-candidate result, rerun with the explicit path of the chosen
file:

```powershell
node tools/inspect-form-diagnostic-json.js 'C:\tmp\archery-note-form-diagnostics.json'
```

The checker rejects a normal schema-5 backup, unknown keys, incomplete runs,
missing fire fields, invalid fire ranges, and files over 65536 UTF-8 bytes.

## Normal backup fallback (not a 3×6 pass)

If the diagnostic export is unavailable but a normal schema-5 backup exists, run
the separate privacy-safe aggregate inspector. It prints only record counts,
shot-count histogram, release-candidate/rejected-frame counts, canceled-event
count, and fixed phase buckets; it never prints IDs, dates, notes, features,
receipt contents, or raw frame data:

```powershell
node tools/inspect-form-backup-diagnostics.js `
  'C:\tmp\archery-note-backup.json'
```

This fallback can explain zero-shot tendencies, but it cannot prove a current
candidate's 3×6 field result, retained receipt fire fields, or artifact privacy
allowlist. Do not treat its output as acceptance evidence or tune thresholds
from it alone.

Record only commit/tree IDs, iOS/Safari versions without local identifiers, aggregate condition results, pass/fail, and artifact SHA-256.

## Latest artifact audit (valid but provisional)

The Downloads artifact was revalidated without modifying or importing the JSON:
schema 1, app version 84, matrix `field-3x6`, 9,869 UTF-8 bytes, and SHA-256
`7452e0bdf3ad87e4735447e024e791da5ef123f2c85642f685ccc9b871c82114`.
The privacy-safe aggregate is side `6/6` from 8 receipts with 2 automatic
cancellations and 0 unresolved, oblique `6/6` from 6, and normal_range `6/6`
from 6; all retained receipts are confirmed.

This artifact is valid but remains provisional: schema 1 does not contain
preview provenance, so it cannot be bound to the current candidate. The old
video report (真横 3/6, やや斜め 0/6, 通常設置 3/6) is therefore not contradicted
or replaced by this file. Repeat the trusted HTTPS 3×6 sequence on the current
preview and confirm commit `0160574ae396a024f22660d8b78c219e516a968c`, tree
`f7ae775edc37ed9dbcb535f6a5f69fec8cda1637`, before accepting the artifact.
Keep the JSON outside the repository.
