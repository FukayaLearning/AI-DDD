# Proposal

## Why

AI-DDD は「仕様 → DDD 実装 → C1 100% テスト」の骨格を提供しているが、ソフトウェア工学・プロジェクト管理の観点では **(1) 多言語チームへの対応、(2) 規模拡大時のソース構造、(3) 仕様・実装・テストのトレーサビリティ、(4) 試験計画と試験仕様書（結合・単体）** が欠落している。現状のままでは「カバレッジ 100% だが何を保証しているのか説明できない」「ファイル増加で層ディレクトリが平坦に肥大化する」「英語以外のユーザーが仕様をレビューできない」という品質・管理リスクが残るため、プラットフォーム（`ddd-driven` スキーマ・CLI・スキル・4 言語サンプル）として標準化する。

## Review Findings（レビュー結果）

ユーザー指摘 5 点に加え、リポジトリ調査で以下を確認した（✅ = 本変更で対応、⏭ = 後続変更で対応）。

| # | 観点 | 現状（観測事実） | 対応 |
| :-- | :-- | :-- | :-- |
| F1 | 多言語対応 | 成果物・UL・Web UI がすべて英語固定（`<html lang="en">`、文言ハードコード） | ✅ |
| F2 | ソース構造 | 各層が平坦（例: `src/domain/order.ts`, `value_objects.ts`）。集約・ユースケース単位の分割規約と検証がない | ✅ |
| F3 | トレーサビリティ | Requirement / Scenario に ID がなく、テストは 1 関数に assert を羅列（例: `tests/unit/application.test.mjs` の `run()`）。どの Scenario をどのテストが検証するか機械的に辿れない | ✅ |
| F4 | 結合テスト | 結合テストは正常系 1 本のみ（`scripts/test-integration.sh`: 作成→確定→取消）。外部 API 失敗・在庫不足・決済拒否・不正遷移・入力不正などの異常系が未試験。試験計画・試験仕様書の成果物がない | ✅ |
| F5 | 単体テスト | 試験設計技法（同値分割・境界値・状態遷移等）や期待結果の根拠が文書化されておらず、C1 100% が事実上の唯一の完了基準 | ✅ |
| F6 | 仕様ベースライン | `bootstrap-ai-ddd-platform` は全タスク完了だが未アーカイブで、`openspec/specs/` が空（メイン仕様が未確立） | ✅（前提作業としてアーカイブ） |
| F7 | 構成ドリフト | スキーマ・スキルが 4 サンプル × 4 ツール分コピーされており、ルートとの差分検出手段がない。スキーマ `version: 1` のまま改版管理がない | ✅ |
| F8 | CI | `npm test` を実行する CI ワークフローが存在しない | ⏭ |
| F9 | 設計判断履歴 | ADR（Architecture Decision Record）の仕組みがなく、`design.md` はアーカイブ後に参照されにくい | ⏭ |
| F10 | 非機能要件 | 性能・セキュリティ・可用性などの NFR をスペック化するテンプレートがない | ⏭（試験計画に NFR 欄のみ先行追加） |
| F11 | 検証器の精度 | `src/verifier.js` は正規表現ベースで誤検知・見逃しの余地がある | ⏭ |

## What Changes

- **多言語化（Localization）**
  - マスター言語を英語に固定し、`ai-ddd init --locale <code>` で指定したユーザー言語が英語以外の場合、`proposal` / `specs` / `design` / `test-plan` / `docs/domain/*` / 試験仕様書の言語別翻訳ファイル（`<name>.<locale>.md`）を生成・維持する。
  - 翻訳ファイルはマスターのハッシュを保持し、`ai-ddd verify` がマスター更新後の翻訳陳腐化を検出する。
  - Presentation の Web UI 文言をメッセージカタログ化し、指定ロケールで表示する（`<html lang>` も追従）。カタログのキー整合性を検証する。
- **DDD ソース階層の細分化（Source Structure）**
  - Layer-first を維持しつつ、各層の内部を `<集約 / ユースケース / 外部コンテキスト / 技術>` 単位のモジュールに細分化する標準構造を定義し、`domain/shared`（Shared Kernel）を導入する。
  - `ai-ddd verify` に構造ルール（層ルート直下のファイル禁止、集約モジュール間の直接依存禁止、ディレクトリあたりファイル数の警告閾値）を追加する。
- **トレーサビリティ（Traceability）**
  - Requirement / Scenario 見出しに安定 ID（`REQ-<CTX>-NNN` / `SCN-<CTX>-NNN-NN`）、試験ケースに `UT-` / `IT-` ID を付与し、実装には `@implements`、テストコードには試験ケース ID を記載する規約を定義する。
  - 新コマンド `ai-ddd trace` で 要求 → シナリオ → 試験ケース → テストコード → 実装 のマトリクス（`docs/traceability/matrix.md`）を生成し、`--check` で未カバー・孤立参照を検出する。
- **試験計画・試験仕様書（Test Specification）**
  - **BREAKING（スキーマ）**: `ddd-driven` スキーマに `test-plan` 成果物を追加し、`proposal → specs → design → test-plan → tasks` の 5 段階とする（`tasks` は `test-plan` に依存）。スキーマを `version: 2` に改版する。
  - 結合テスト仕様書（`docs/testing/integration/<capability>.md`）: 各 Scenario の GIVEN/WHEN/THEN を正常系ケースとし、異常系導出チェックリスト（入力境界・不正状態遷移・外部依存障害・永続化障害・重複/競合・未存在・ロケール表示）を全項目「ケース化」または「非該当理由の明記」で埋める。
  - 単体テスト仕様書（`docs/testing/unit/<layer>/<module>.md`）: 設計要素ごとに試験設計技法・入力・期待結果・根拠を記載し、C1 100% は「完了条件の一つ」に位置付ける。
- **リファレンスサンプルとスケルトンの追従**: 4 言語サンプルと `ai-ddd init` スケルトンを新構造・ID・試験仕様書・異常系結合テスト・日本語ロケールに移行する。
- **構成ドリフト検出**: サンプル内のスキーマ・スキルのコピーがルートと一致することを `npm run verify:examples` で検証する。

## Capabilities

### New Capabilities
- `localization`: 英語マスター＋ユーザー指定言語の翻訳成果物管理、翻訳陳腐化検出、Web UI のロケール表示
- `source-structure`: DDD 層内部のモジュール細分化規約（集約・ユースケース・外部コンテキスト・ドライバ技術単位）とその静的検証
- `traceability`: 要求・シナリオ・試験ケース・テストコード・実装の ID 体系、トレーサビリティマトリクス生成と欠落検出
- `test-specification`: 設計段階の試験計画、結合テスト仕様書（正常系＋異常系導出）、単体テスト仕様書の作成・維持規約

### Modified Capabilities
- `ddd-schema`: 4 段階成果物グラフを `test-plan` を含む 5 段階へ変更し、スキーマ改版・言語/構造/トレーサビリティ規約をテンプレートへ組み込む
- `cli-installer`: `init` に `--locale` を追加し、`verify` に構造・翻訳・ドリフト検証を追加、`trace` コマンドを新設する
- `reference-examples`: 4 言語サンプルが新構造・トレーサビリティ・試験仕様書・異常系結合テスト・日本語 UI を実証する

> [!NOTE]
> 上記 3 つの既存 capability は `bootstrap-ai-ddd-platform` の delta として定義済みだが未アーカイブ。本変更の実装着手前に bootstrap をアーカイブし、`openspec/specs/` にベースラインを確立する（F6）。

## Impact

- **スキーマ / テンプレート**: `schemas/ddd-driven/schema.yaml`（v2、`test-plan` 追加）、`templates/*.md`（`test-plan.md` 新設、ID 記法・翻訳規約）
- **スキル / エージェント規約**: `skills/ddd-workflow/SKILL.md`、`src/installer.js` が生成する `AGENTS.md` / `openspec/config.yaml`
- **CLI**: `src/cli.js`（`--locale`、`trace`）、`src/verifier.js`（構造・翻訳・ドリフト）、新規 `src/tracer.js`、`src/skeletons/*.js`（新ディレクトリ構造・i18n カタログ・試験仕様書雛形）
- **サンプル**: `examples/{typescript,python,go,rust}/` のソース再配置（**BREAKING**: import パス変更）、テスト分割・ID 付与、異常系結合テスト、`ja` 翻訳成果物
- **テスト**: `tests/cli.test.mjs` への新機能テスト追加、`npm test` / `npm run verify:examples` の実行時間増
- **前提作業**: `bootstrap-ai-ddd-platform` のアーカイブ
