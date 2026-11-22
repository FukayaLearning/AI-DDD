# Tasks

> Git 管理下のため、`openspec-apply` 開始時に作業ブランチ（例: `feat/strengthen-engineering-governance`）を確認・作成して本計画成果物をベースラインコミットし、以降は 1 タスク完了ごとに `tasks.md` 更新を含めて 1 コミットする。

## 1. 前提: 仕様ベースラインの確立

- [x] 1.1 `bootstrap-ai-ddd-platform` を `openspec-archive-change` でアーカイブし、`openspec list --specs` に `ddd-schema`・`cli-installer`・`reference-examples` が表示され、`openspec validate strengthen-engineering-governance --strict` で「Archive would refuse this delta」通知が消えることを確認する

## 2. スキーマ v2・テンプレート・スキル

- [x] 2.1 `schemas/ddd-driven/schema.yaml` を `version: 2` とし `test-plan` 成果物（`requires: [specs, design]`）を追加、`tasks.requires` に `test-plan` を追加する。一時ディレクトリで `openspec schema validate ddd-driven` が成功し、新規変更の `openspec status --json` で依存順が仕様どおりであることを確認する
- [x] 2.2 `templates/test-plan.md` を新設（Test Scope / Test Levels / Environment / Entry & Exit Criteria / Non-Functional / Abnormal-Path Checklist 7 カテゴリ / Test Case Delta）し、`spec.md` テンプレートに `REQ-`/`SCN-` 見出し記法、`design.md` にモジュール構造節、`tasks.md` に試験仕様書作成・trace check・翻訳同期の各タスクを追加する。各 instruction に英語マスター＋`i18n/<locale>/` 翻訳規約を記載し、`openspec schema validate` 成功を確認する
- [x] 2.3 `skills/ddd-workflow/SKILL.md` に 多言語（翻訳作成・`i18n stamp`・アーカイブ時の Translation Sync）、モジュール構造、ID 採番規約（最大値 + 1・再利用禁止）、試験仕様書作成手順（異常系チェックリスト・試験設計技法）を追記し、ルート `AGENTS.md` と `README.md` の該当説明を更新する。記載コマンド例が実在するオプションと一致することをレビューで確認する

## 3. CLI: 設定・初期化

- [x] 3.1 `ai-ddd.config.json`（D1）の読込モジュールを追加し、`init` に `--locale`（BCP 47 検証、既定 `en`）と `--context-code`（既定は context 先頭 3 文字大文字）を追加、生成する `openspec/config.yaml` の context と `AGENTS.md` にロケール規約を記載する。`tests/cli.test.mjs` に「ja 初期化」「既定 en」「不正ロケールで exit 1・無書込」のテストを追加し `npm test` の CLI 部が成功することを確認する

## 4. CLI: 検証器拡張

- [x] 4.1 `src/verifier.js` に構造ルール（層ルート直下ファイル禁止・集約モジュール分離・ディレクトリサイズ警告、D6）を追加し、違反/非違反フィクスチャのテストを `tests/cli.test.mjs` に追加して成功を確認する
- [x] 4.2 翻訳検証（ハッシュ不一致・source 不在・必須翻訳欠落、D3）と `ai-ddd i18n stamp` サブコマンド、Web UI カタログキー整合検査（D4）を実装し、各違反ケースと stamp 後の合格をテストで確認する
- [x] 4.3 スキーマバージョン警告と、`schemaVersion` < 2 のプロジェクトで新ルールを警告扱いにする段階移行（D10）を実装し、v1 フィクスチャで終了コード 0＋警告、v2 で終了コード 1 となるテストを追加する

## 5. CLI: トレーサビリティと試験仕様書検査

- [x] 5.1 `src/tracer.js` と `ai-ddd trace`（`--check`・`--format json`・`--include-changes`）を実装し、ID 重複・見出し ID 欠落・SCN に IT なし・REQ に `@implements` なし・テスト不在ケース・孤立参照の各検出と `docs/traceability/matrix.md` 生成をフィクスチャテストで確認する
- [x] 5.2 結合試験仕様書の異常系チェックリスト検査と、ケース ID を持たないテストの検出（言語別テスト名抽出、D8）を `verify` に組み込み、4 言語のテストファイル書式それぞれで検出/非検出をテストで確認する

## 6. スケルトン生成の追従

- [x] 6.1 `src/skeletons/{typescript,python,go,rust}.js` をモジュール構造（D5）・`presentation/web/i18n`（en + ユーザー言語）・ID 付きサンプル仕様/テスト・`docs/testing/` 雛形・`docs/domain/*.<locale>.md`（ハッシュ付き）生成に更新する。4 言語 × 3 配布形態 × `--locale en|ja` で `init` → `ai-ddd verify` → `ai-ddd trace --check` が成功し、生成スケルトンのテストが通ることを `tests/cli.test.mjs` で確認する

## 7. TypeScript サンプルの移行（規約の確定）

- [x] 7.1 `examples/typescript/src` をモジュール構造へ再配置（ACL ポートを `application/shared` へ移動）し、`docs/domain/ubiquitous-language.md` の Layer 列を更新する。`ai-ddd verify` と既存テスト・C1 100% が通ることを確認する
- [x] 7.2 `openspec/specs/ordering/order-management/spec.md` に `REQ-ORD-`/`SCN-ORD-` を付与し、`docs/testing/unit/**` と `docs/testing/integration/order-management.md`（正常系＋異常系チェックリスト全 7 カテゴリ）を作成する。仕様書の各ケースに技法・期待結果・根拠が記載されていることを確認する
- [x] 7.3 単体テストを `node:test` の 1 ケース 1 テストへ分割して UT ID をテスト名に付与し、ユースケース実装に `@implements` を付与する。C1 100% と `ai-ddd trace --check`（UT 部分）が成功することを確認する
- [x] 7.4 結合テストハーネスに外部スタブのモード切替・永続化障害・タイムアウト短縮（D9）を追加し、IT ケース（入力不正・不正遷移・在庫不足・決済拒否・タイムアウト・利用不可・永続化障害・未存在・ロケール表示）を実装する。`scripts/test-integration.sh` が全 IT を合格し `ai-ddd trace --check` が完全に成功することを確認する
- [x] 7.5 Web UI をメッセージカタログ化（en/ja、`APP_LOCALE`）し、ブラウザテストで両ロケールの文言と `<html lang>` を検証する。`ai-ddd.config.json` を `ja` に設定し、メイン仕様・`docs/domain/`・試験仕様書の `.ja.md` 翻訳を作成・stamp する。`ai-ddd verify` と Presentation C1 100% の成功を確認する

## 8. Python / Go / Rust サンプルへの横展開

- [ ] 8.1 Python サンプルに 7.1–7.5 と同等の構造・ID・試験仕様書・異常系結合テスト・ja 対応を適用し、`scripts/run-all.sh`・`ai-ddd verify`・`ai-ddd trace --check` の成功を確認する
- [ ] 8.2 Go サンプルに同等の変更を適用（テストは同一パッケージの `*_test.go` を維持）し、`scripts/run-all.sh`・`ai-ddd verify`・`ai-ddd trace --check` の成功を確認する
- [ ] 8.3 Rust サンプルに同等の変更を適用（`mod.rs` によるモジュール宣言）し、`scripts/run-all.sh`・`ai-ddd verify`・`ai-ddd trace --check` の成功を確認する

## 9. 構成ドリフト検出

- [ ] 9.1 `scripts/check-drift.mjs` を追加して `npm run verify:examples` から呼び出し、サンプル内のスキーマ・テンプレート・各ツール向け `ddd-workflow` スキルをルート原本と同期する。意図的に 1 ファイルを改変すると非ゼロ終了し、戻すと成功することを確認する

## 10. 統合検証とレビュー

- [ ] 10.1 実行用サブエージェントで `npm test`・`npm run verify:examples`・`openspec validate strengthen-engineering-governance --strict` を実行し、すべて成功することを確認する
- [ ] 10.2 ゼロコンテキストの独立レビューサブエージェントで、仕様（7 capability）と実装・試験仕様書・トレーサビリティマトリクス・翻訳の整合を監査し、指摘を解消する

## Workflow follow-up

- レビュー完了後、本変更を `openspec-archive-change` でアーカイブし、`openspec/specs/` に `localization`・`source-structure`・`traceability`・`test-specification` が作成され、`ddd-schema`・`cli-installer`・`reference-examples` が更新されたことを確認する。
- 後続変更候補（proposal F8–F11）: CI ワークフロー、ADR 運用、NFR 仕様テンプレート、AST ベース検証器。
