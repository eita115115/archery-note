# Third-party Notices

This document tracks third-party software, assets, and model files used by Archery Note.

| Name | Source | License | Usage | Notes |
|---|---|---|---|---|
| npm dependencies | `package.json` | See dependency licenses | development/build | Review before release |
| Capacitor | `@capacitor/*` packages | MIT | native-ready shell | Used through npm dependencies |
| App icon assets | `icon.svg`, `apple-touch-icon.png` | Project asset | app shell | Maintained in this repository |
| README screenshots | `docs/screenshots/*.png`, captured from the Archery Note public demo | Apache-2.0 | README documentation | Self-made UI screenshots with sample local data; no third-party asset content is intentionally included |

Archery Note does not include OCR, pose, photo AI, or external model files in this OSS readiness work.

## Screenshot provenance

The README screenshots in `docs/screenshots/` are captured from Archery Note's self-made UI. They use sample local data in a temporary browser profile and intentionally do not include third-party image, icon, font, model, copied-code, or externally derived asset content.

If a future screenshot includes third-party material, record the material name, source, license, and redistribution notes in this file before merging.

## Asset provenance rule

When adding images, icons, fonts, model files, copied code, screenshots, or other externally derived assets, contributors must update this file before merging.

Each entry should include:

- Name
- Version or date
- Source
- License
- How it is included
- Redistribution notes
- Updated at

Assets with unknown origin must not be merged.
