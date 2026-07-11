# ゴールデン再生ハーネス用 映像ソース記録

作成日: 2026-07-11
方針: 映像ファイルはリポジトリにコミットしない。この記録の URL から `fetch-videos.py` で再取得する。
すべてフリーライセンスのストック映像（Pixabay Content License / Mixkit License）。
YouTube 等の利用規約で保護された映像は使用していない。

## ライセンス概要

- **Pixabay Content License**: 商用・非商用とも無償利用可、帰属表示不要。
  コンテンツ単体での再配布は不可（→ 映像ファイル自体をリポジトリに含めない理由）。
  https://pixabay.com/service/license-summary/
- **Mixkit License (Free Items)**: 商用・非商用とも無償利用可、帰属表示不要。
  素材そのものの再配布は不可。
  https://mixkit.co/license/#videoFree

## 採用映像（ハーネス実行対象）

### 1. pixabay-43254-archery-woman.mp4
- 出典ページ: https://pixabay.com/videos/archery-woman-target-garden-nature-43254/
- 直接URL: https://cdn.pixabay.com/video/2020/06/27/43254-435970559_large.mp4
- ライセンス: Pixabay Content License
- 内容: 庭の射場で女性が単独でリカーブを1射。全身が写る（やや後方斜めからの引き視点、
  カメラは高め・後半は無人の射場へパン）。1920x1080 / 13.6秒。
- 目視期待射数: **1射**（約1〜4秒に打ち起こし→引き分け→リリース。5秒以降は弓を降ろして退場、
  9秒以降は無人）。
- 検出期待値: **1射**（2026-07-11 実測で一致）。
- 想定用途: 「全身・単独射手・実射1射」の基本ゴールデンケース（正例）。
  ただし後方斜め視点のため側面理想条件ではない（角度誤差は許容し、射数一致のみ検証）。

### 2. pixabay-40769-archer.mp4
- 出典ページ: https://pixabay.com/videos/archer-archery-bow-arrow-bowman-40769/
- 直接URL: https://cdn.pixabay.com/video/2020/06/01/40769-426939441_large.mp4
- ライセンス: Pixabay Content License
- 内容: 男性リカーブ射手の側面ビュー（上半身のみ、腰から上）。フルドロー→リリースの瞬間
  （約0〜2.5秒）→ カットが変わり的から矢を抜くシーン。1920x1080 / 10.9秒。
- 目視期待射数: **1射**（冒頭のリリース1回。ただし打ち起こし〜引き分けは映っておらず
  フルドローから始まる。下半身が映らないため全身ランドマークは不完全）。
- 検出期待値: **0射（境界ケース）**。実測トレースでリリース速度スパイク
  （14.76 胴体長/秒 > 閾値9）は観測されるが、その直後のフレームでシーンカットが
  発生し人物が消失、`!close`（アンカー圏離脱）を確認できる前に判定材料が絶たれる。
  映像編集の限界であり検出器の欠陥ではない。この「スパイクは見えるが確定不能」を
  固定する回帰ケースとして価値がある。
- 想定用途: 「側面・上半身のみ・カット切替あり」のハードケース。
  フェーズ検出が部分骨格＋シーン切替でどう振る舞うかの回帰基準。

### 3. mixkit-34710-female-archer.mp4
- 出典ページ: https://mixkit.co/free-stock-video/female-archer-shooting-an-arrow-34710/
- 直接URL: https://assets.mixkit.co/videos/34710/34710-720.mp4
- ライセンス: Mixkit License (Free Items)
- 内容: 女性がロングボウ（伝統弓）を正面〜斜め前方から撮影。頭部と両腕・胴体上部が写る
  （下半身は画面外）。引き分け→狙い→リリースが1回。1280x720 / 10.5秒。
- 目視期待射数: **1射**（約1〜6秒で引き分け保持、6〜7秒でリリース）。
- 検出期待値: **0射**。正面視のため引き分け・リリースの動きがカメラ光軸方向で、
  2Dランドマークではほぼ変位が出ない（実測トレース: 速度最大0.58 胴体長/秒、閾値9）。
  アプリの設計前提（横向き撮影）から外れた入力で誤検出しないことを固定するケース。
- 想定用途: 「前方斜め・上半身・伝統弓」= 設計対象外アングルのネガティブ寄りケース。

### 4. mixkit-48725-closeup-firing.mp4
- 出典ページ: https://mixkit.co/free-stock-video/close-up-of-a-person-firing-an-arrow-at-a-48725/
- 直接URL: https://assets.mixkit.co/videos/48725/48725-720.mp4
- ライセンス: Mixkit License (Free Items)
- 内容: 手元（弓手・ロングボウのグリップ）の接写。顔・肩の一部のみで全身は写らない。
  リリース1回。1280x720 / 6.4秒。
- 目視期待射数: **1射だが骨格不可視** → 検出期待値: **0射**。
- 想定用途: ネガティブ寄りケース（接写では MediaPipe が部分骨格を拾うことがある
  — 実測 136/173 フレームでランドマーク出力あり — がリリース誤検出しないこと）。

### 5. pixabay-150869-arrows-target.mp4
- 出典ページ: https://pixabay.com/videos/arrows-target-bow-and-arrow-sport-150869/
- 直接URL: https://cdn.pixabay.com/video/2023/02/15/150869-799327585_large.mp4
- ライセンス: Pixabay Content License
- 内容: 的紙の固定接写。矢が次々と刺さる（人物は一切映らない）。1920x1080 / 23.4秒。
- 目視期待射数: **0射**（人物なし。純粋なネガティブコントロール）。
- 想定用途: 誤検出（false positive）ゼロを確認するネガティブケース。

## 不採用（ダウンロード済みだが対象外）

### pixabay-176737-arch-sports.mp4
- 出典: https://pixabay.com/videos/arch-archery-bow-archers-sports-176737/
  （https://cdn.pixabay.com/video/2023/08/19/176737-856049575_large.mp4）
- 理由: グリーンバック上のCGコンパウンドボウのみで人物なし。姿勢検証に不適。

### pixabay-337261-target-archer.mp4
- 出典: https://pixabay.com/videos/target-archer-resolution-strategy-337261/
  （https://cdn.pixabay.com/video/2026/02/28/337261_large.mp4）
- 理由: 2Dアニメーション（イラスト調の人物）。実写でないため基準ケースに不適。
  ※イラスト人物にPoseが反応するかのファズケースとしては将来利用可。

### pixabay-55583-pikado.mp4
- 出典: https://pixabay.com/videos/game-pikado-shoot-arrow-archery-55583/
  （https://cdn.pixabay.com/video/2020/11/07/55583-502340132_large.mp4）
- 理由: ダーツボードのCGアニメーション。アーチェリーの実写ではない。

## 探索メモ（再現用）

- Pexels は Cloudflare のボットチャレンジで curl / WebFetch / headless ブラウザとも
  詳細ページへ到達できず断念（検索一覧のみ取得可）。人手ブラウザなら取得可能。
  候補: pexels.com/video/6540032/ (Archer Shooting), 6668634 (A Man Shooting a Target)。
- Coverr は検索パスが変更されており `?q=archery` で 404。ヒットなし。
- Pixabay 検索: `archery` / `archer` / `target archery` で計6本の実写・アニメ候補を確認。
  「側面・全身・単独射手」の理想条件を満たす実写はストック映像には少なく、
  実写3本＋接写1本＋ネガティブ1本の構成とした。
- Mixkit 検索: `archery` で4本。うち2本（34710, 48725）が人物射撃シーン。
