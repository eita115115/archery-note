# 射形トラッキング資産の出所と再取得手順 (Task F3, 2026-07-03)

`assets/pose/` の資産はすべて Apache-2.0（本リポジトリと同一ライセンス）。
ランタイムは CDN を使わず、この自己ホスト分のみを参照する。
Service Worker の precache（`sw.js` の `ASSETS`）には**含めない**。
機能フラグ有効時の初回利用でランタイムキャッシュに載り、以後オフラインでも動く。

## ファイルと SHA-256

| ファイル                    | サイズ      | SHA-256                                                            |
| --------------------------- | ----------- | ------------------------------------------------------------------ |
| `pose_landmarker_lite.task` | 5,777,746 B | `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a` |
| `vision_bundle.mjs`         | 136,870 B   | `e77f281f9619150d937023c355bae170e9120e3b9e43f1e23a2a7bee07197669` |
| `vision_wasm_internal.js`   | 209,826 B   | `9440cf0cc0cea21800e31581ec32aeedcc5fbf9df4509796bbc7d3f99e52ab9c` |
| `vision_wasm_internal.wasm` | 9,423,986 B | `f82a8e6c05e08a44cc9f9e7ec5f845935bcbb1b1500ebe8c2f4812fb4e2917dc` |

合計 約 15.5 MB。**SIMD ビルドのみ同梱**（nosimd 版は約 +10MB のため除外。
WebAssembly SIMD 必須 = iOS 16.4+ / 近年の Chrome・Edge・Firefox。
非対応環境では射形トラッキングのみ利用不可、他機能に影響なし）。

## 再取得手順（バージョン更新時）

```powershell
$v = "0.10.14"
curl -L -o assets/pose/vision_bundle.mjs "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@$v/vision_bundle.mjs"
curl -L -o assets/pose/vision_wasm_internal.js "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@$v/wasm/vision_wasm_internal.js"
curl -L -o assets/pose/vision_wasm_internal.wasm "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@$v/wasm/vision_wasm_internal.wasm"
curl -L -o assets/pose/pose_landmarker_lite.task "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
Get-FileHash assets/pose/* -Algorithm SHA256
```

更新時は本ファイルの SHA-256 表と `THIRD_PARTY.md` の Updated at を必ず更新する。
npm 依存としては追加しない（静的コピーが正。`package.json` を変更しないこと）。

## ライセンス根拠

- ランタイム: `@mediapipe/tasks-vision` は Apache-2.0（npm / upstream
  google-ai-edge/mediapipe）
- モデル: BlazePose GHUM 3D のモデルカードに Apache License 2.0 と明記
  https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf

## プライバシー原則（実装側の遵守事項）

- 姿勢推定は 100% オンデバイス。カメラ映像・ランドマークを外部送信しない
- 動画・全フレームランドマーク列は保存しない。保存するのは
  `formAnalyses` の派生特徴量のみ（ユーザーが明示的に保存した場合のみ）
