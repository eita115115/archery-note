# Third-party Notices

This document tracks third-party software, assets, and model files used by Archery Note.

| Name                                   | Source                                                                                                                                                                | License                                   | Usage                                   | Notes                                                                                                                                                                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm dependencies                       | `package.json`                                                                                                                                                        | See dependency licenses                   | development/build                       | Review before release                                                                                                                                                                                                                          |
| Capacitor                              | `@capacitor/*` packages                                                                                                                                               | MIT                                       | native-ready shell                      | Used through npm dependencies                                                                                                                                                                                                                  |
| App icon assets                        | `icon.svg`, `apple-touch-icon.png`                                                                                                                                    | Project asset                             | app shell                               | Maintained in this repository                                                                                                                                                                                                                  |
| README screenshots                     | `docs/screenshots/*.png`, captured from the Archery Note public demo                                                                                                  | Apache-2.0                                | README documentation                    | Self-made UI screenshots with sample local data; no third-party asset content is intentionally included                                                                                                                                        |
| MediaPipe Tasks Vision (web runtime)   | `assets/pose/vision_bundle.mjs`, `assets/pose/vision_wasm_internal.{js,wasm}` — `@mediapipe/tasks-vision@0.10.14` via jsDelivr (upstream: google-ai-edge/mediapipe)   | Apache-2.0                                | Form tracking (on-device pose runtime)  | Self-hosted static copy, no CDN at runtime, loaded lazily only when form tracking is enabled. SIMD build only (iOS 16.4+/modern browsers). SHA-256 and reproduction steps in `docs/form-tracking-assets.md`. Updated at 2026-07-03             |
| MediaPipe Pose Landmarker (lite) model | `assets/pose/pose_landmarker_lite.task` from https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task | Apache-2.0 (BlazePose GHUM 3D model card) | Form tracking (33-point pose landmarks) | On-device inference only; no image or landmark data leaves the device. Model card: https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf . SHA-256 in `docs/form-tracking-assets.md`. Updated at 2026-07-03 |

OCR and photo-AI model files remain excluded. The pose assets above are the
only model files in the repository, added with the provenance recorded here.

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
