# 履歴のラウンド折りたたみ

目的: 同じ多距離ラウンドの記録をまとめ、合計と各距離を少ないスクロールで振り返る。
広い改善委任に沿って、既存ロードマップIMP-09の表示部分だけを実装する。

## 設計と範囲

- 既存のroundGroup.gidが一致する表示対象が2件以上ある場合だけ、native detailsでまとめる。単独記録は従来の行を保つ。
- 合計点・本数・記録済みステージ数・距離を閉じた状態でも読める。開くとステージ順に従来の詳細ボタンを表示する。
- 最新の記録の位置にグループを置く。同じラウンドが日をまたいでも一つにする。各子行には元の日付を残す。
- フィルタに合う記録だけを集計し、条件適用時は「表示分合計」と明記する。欠けたステージの補完や完了判定はしない。
- 「さらに表示」はグループを分割しない。50個の表示単位ずつ追加する。開閉状態はメモリのみでタブ移動・再描画後も保つ。
- 保存データ、採点、分析、CSV、SW、依存は変更しない。

比較した案: 従来の全行表示はラウンド全体を追いにくい。別の専用画面は操作が増える。既存リスト内の折りたたみを採用する。

ビジョン4条件: 既存ラウンドと得点・用具履歴を結ぶ／過去ラウンドを振り返りやすくする／端末内処理／日々の履歴閲覧の操作を減らす。新たな指標やデータ収集は追加しない。

## 実装・検証順

1. 実ブラウザの回帰を先に追加し、現状で目的どおり失敗することを確認する。375pxの変更前画像を保存する。
2. 表示単位の組み立てとnative details、控えめな罫線・字下げを追加する。
3. 合計・順序・絞込・境界での追加表示・開閉保持・詳細遷移・保存不変を検証する。320/375pxと両エンジン、ダーク表示を点検する。
4. UI/app/lint/format検証、375px変更後画像、独立レビューを記録する。公開は別のリリース検証・承認後。

## 結果

- 実装: scripts/60-history-sight-view.js、style.css / style.min.css。回帰: tests/e2e/history-round-collapse.spec.js、既存app-smokeの展開手順。
- 実装前の2テストはhistory-round要素が無いことを理由に失敗。実装後の基本2テストは成功。
- 両エンジンで新規4ケースと既存履歴・タブ位置・アプリsmokeを実行。初回は28成功/4失敗。既存smokeが閉じた子行を直接クリックしていたため展開操作を追加。部分フィルタのfixture差し替えが反映されなかったため初期seedへ統合。その後:

```text
32 passed (31.5s)
```

- 最終テストには1280pxでの横はみ出し・44px操作領域も追加。320/375px、light/dark、合計・ステージ順・日付跨ぎ・途中終了・フィルタ・ページ境界・開閉保持・詳細遷移・既存架空データ不変を確認:

```text
8 passed (11.2s)
```

- 必須チェックの出力:

```text
UI smoke checks OK (chrome.exe)
Score distribution: 36000 arrows, 72000 score reads
Archery Note checks OK (v93)
check-globals OK (14 files, 1215 unresolved refs all accounted for)
```

- lint成功（最初の追加テストのdocument未定義エラーはglobalThis参照へ修正）。format:check成功。
- requesting-code-reviewの独立静的レビュー: 指摘事項なし。別の保存・採点・SW変更なし。
- 375pxの変更前後とdark画像: docs/screenshots/history-round-before-375.png、history-round-after-375.png、history-round-after-dark-375.png。Chromium同幅で撮影し、展開状態の画像も目視確認。
- 詳細ログ: artifacts/history-round/e2e.txt（初回失敗を保持）、e2e-fixed.txt、focused-final.txt、lint-final.txt、format.txt。

公開v93は変更していない。版更新・全体回帰・更新時保持のリリース検証は [v94候補](release-v94.md) で完了。次はAGENTS.mdの公開承認条件を満たしてからpushする。実機iPhoneの操作感とAN-001実射受入は未確認。費用・個人情報の使用なし。
