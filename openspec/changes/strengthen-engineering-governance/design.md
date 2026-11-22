# Design

## Context

- 動機とレビュー結果は proposal.md の「Why」「Review Findings」を参照。要求は `specs/` 配下を参照。
- 現行プラットフォームは Node.js 22 / 依存ゼロの CLI（`src/cli.js`・`src/verifier.js`・`src/installer.js`・`src/skeletons/*.js`）と、4 言語のサンプル（`examples/*`）で構成される。サンプルは各層が平坦なファイル配置で、テストは 1 関数内の assert 羅列、結合テストは正常系 1 本のみ。
- `bootstrap-ai-ddd-platform` は未アーカイブで `openspec/specs/` が空。`ddd-schema` と `cli-installer` の MODIFIED/REMOVED delta はベース仕様が必要（`openspec validate` が「Archive would refuse this delta」を通知済み）。
- 調査で判明した OpenSpec の制約: 変更内 `specs/` 配下に `spec.ja.md` を置くと `openspec validate` がエラー（Delta spec must be a spec.md）となる。一方、変更内の `i18n/` ディレクトリやメイン仕様ディレクトリ内の `spec.ja.md` は検証に影響しない（実測）。

## Goals / Non-Goals

**Goals:**
- 4 機能（多言語・構造・トレーサビリティ・試験仕様）を **スキーマ / スキル / CLI / スケルトン / サンプル** の全経路で一貫して提供する。
- すべての新規則を `ai-ddd verify`（または `ai-ddd trace --check`）で機械検証可能にし、AI エージェントの規約逸脱を検出できるようにする。
- CLI の依存ゼロ方針を維持する。

**Non-Goals:**
- CI ワークフロー、ADR、NFR 仕様テンプレート、AST ベース検証器（proposal F8–F11、後続変更）。
- 翻訳の自動機械翻訳（翻訳作成は AI エージェントのワークフロー手順として行い、CLI はハッシュ検証のみ）。
- 実行時の動的ロケール切替 UI（Accept-Language 交渉など）。表示ロケールは起動時設定で決定する。
- テスト実行結果（合否）のマトリクスへの取り込み。

## Decisions

### D1. プロジェクト設定ファイル `ai-ddd.config.json` の新設
ロケール・コンテキスト略号・構造閾値を保持する単一設定を新設する。

```json
{
  "schemaVersion": 2,
  "context": { "name": "ordering", "code": "ORD" },
  "locale": { "master": "en", "user": "ja" },
  "structure": { "maxFilesPerDirectory": 15 },
  "coverage": { "configFile": "c1-coverage.config.json" }
}
```

- **代替案**: `openspec/config.yaml` に独自キーを追加 → OpenSpec 側のスキーマ拡張に依存し将来衝突リスクがあるため不採用。`context` 文字列への埋め込み → 機械可読性が低く不採用（ただし AI 向けに context へも要約を記載する）。
- `c1-coverage.config.json` は既存の言語別カバレッジランナーが参照するため据え置き、統合は後続で検討。
- `--context-code` 未指定時は `--context` の先頭 3 文字を大文字化して既定値とする（例: `ordering` → `ORD`）。

### D2. 翻訳ファイルの配置規約（2 系統）
| 対象 | マスター | 翻訳 |
| :-- | :-- | :-- |
| 変更内成果物 | `openspec/changes/<c>/proposal.md`, `specs/**/spec.md`, `design.md`, `test-plan.md` | `openspec/changes/<c>/i18n/<locale>/<同一相対パス>` |
| 永続文書 | `openspec/specs/**/spec.md`, `docs/domain/*.md`, `docs/testing/**/*.md` | 同ディレクトリの `<basename>.<locale>.md` |

- 変更内 `specs/` に兄弟翻訳を置けない OpenSpec 制約（Context 参照）のため、変更内のみ `i18n/` ミラー方式とする。永続文書はレビュー時の視認性を優先し兄弟方式。
- **代替案**: 全翻訳を `docs/i18n/<locale>/` にミラー → 一貫性は高いが原本との距離が遠く更新漏れが起きやすいため不採用。
- アーカイブ時、変更内 `i18n/<locale>/specs/**` の内容をメイン仕様の兄弟翻訳へ反映する手順を `ddd-workflow` スキルの「Translation Sync」として定義する（OpenSpec の archive は翻訳を扱わないため）。

### D3. 翻訳の陳腐化検出（ハッシュ・フロントマター）
翻訳ファイル先頭に以下を必須とする。

```markdown
<!-- ai-ddd-translation: source=spec.md sha256=<64hex> locale=ja -->
```

- `sha256` はマスターファイルの改行を LF に正規化した UTF-8 バイト列のハッシュ。
- `ai-ddd verify` は (a) ハッシュ不一致、(b) source 不在、(c) ユーザー言語 ≠ `en` で必須翻訳欠落、を違反とする。必須対象は永続文書（`docs/domain/*.md`、`docs/testing/**/*.md`、`openspec/specs/**/spec.md`）と進行中変更の成果物。
- 補助コマンド `ai-ddd i18n stamp --target <dir> <translation-file>` で、翻訳更新後にハッシュを書き換えられるようにする（AI/人が手で SHA を計算しなくて済む）。
- YAML フロントマターではなく HTML コメントとするのは、OpenSpec のマークダウン解析・レンダリングに影響を与えないため。

### D4. Web UI のメッセージカタログ
- `presentation/web/i18n/` に `en` と各ユーザー言語のカタログ（TS/Python/Go/Rust それぞれのネイティブなマップ定義。JSON 読込は Go/Rust でのビルド・配布形態差を避けるためソース内定義とする）。
- `main` がプロジェクト設定（環境変数 `APP_LOCALE` で上書き可）から表示ロケールを決め、Presentation に DI で `Messages` を注入する。Presentation は引き続き `infrastructure` を参照しない。
- `DomainError` の `code` → 表示文言の変換もカタログ経由とし、エラー画面は `<code>: <localized message>` を表示（code は英語のまま残し問い合わせ時の識別子とする）。
- `ai-ddd verify` のカタログキー整合検査は、`presentation/**/i18n/` 配下の各ロケールファイルからキー文字列を抽出して集合比較する（言語別の単純な正規表現抽出）。

### D5. 層内モジュール構造（TypeScript 例。他言語も同じ階層で各言語の慣習に従う）

```text
src/
  domain/
    shared/            result, domain-error base, Money, Currency, identifier VOs
    order/             order (aggregate root), order-line, value-objects/, events/, errors, order-repository (port)
  application/
    shared/            ACL ports (inventory-port, payment-port), DTO base
    order/
      commands/        place-order, confirm-order, cancel-order
      queries/         get-order
  infrastructure/
    drivers/kv/        branchless raw key-value I/O
    drivers/http/      branchless raw HTTP I/O
    persistence/order/ driver-order-repository, order-mapper
    acl/inventory/     inventory-gateway, translator
    acl/payment/       payment-gateway, translator
  presentation/
    web/shared/        layout, escape
    web/order/         handlers, views
    web/i18n/          en, ja
  main.ts
tests/
  unit/<layer>/<module>/...   (Go は言語慣習に従い同一パッケージ内 *_test.go を許可)
  integration/...
```

- **ACL ポートの配置**: 現状 `domain/ports` にある `InventoryPort`/`PaymentPort` は外部コンテキストとの協調でありユースケースの関心事のため `application/shared` へ移す。`OrderRepository` は集約に属するため `domain/order` に置く。UL 文書の Layer 列を更新する。
- **代替案**: Feature-first（`src/order/{domain,application,...}`）→ 既存の Layer-first 原則・`ai-ddd verify` の層判定と衝突するため不採用。Layer-first 内でのモジュール化に留める。
- 層判定（`detectLayer`）は既にプレフィックス一致のため深い階層に対応済み。追加するのは構造ルールのみ。

### D6. 構造検証ルール（`src/verifier.js` 拡張）
1. **層ルート直下ファイル禁止**: `(src|internal)/<layer>/<file>` を違反。例外は `mod.rs`・`__init__.py`・`lib.rs` 等のモジュール宣言ファイル。
2. **集約モジュール分離**: `domain/<module>/` から `domain/<other>/`（`shared` 以外）への import を違反。import 解析は既存の言語別抽出を拡張し、層名の次のセグメントまで取得する。
3. **ディレクトリサイズ警告**: `structure.maxFilesPerDirectory` 超過で `warnings` に追加（既存の `warnings` 配列を活用、終了コードに影響なし）。

### D7. ID 体系とトレーサビリティ（新規 `src/tracer.js`）
| 種別 | 形式 | 定義場所 | 参照場所 |
| :-- | :-- | :-- | :-- |
| 要求 | `REQ-ORD-001` | `openspec/specs/**/spec.md` の `### Requirement:` 見出し先頭 | 試験仕様書、`@implements` |
| シナリオ | `SCN-ORD-001-01` | `#### Scenario:` 見出し先頭 | 試験仕様書 |
| 単体試験 | `UT-ORD-001` | `docs/testing/unit/**/*.md` の表 | テスト名 |
| 結合試験 | `IT-ORD-001` | `docs/testing/integration/*.md` の表 | テスト名 |

- ID を見出しに含めるのは、OpenSpec の要求名マッチ（MODIFIED/RENAMED）と同じキーで追跡でき、追加のメタデータ形式を OpenSpec に持ち込まずに済むため。**代替案**: 見出し下の `ID:` 行 → OpenSpec の要求本文 500 文字制限と混ざり、パースも複雑化するため不採用。
- 解析対象: マスター仕様のみ（翻訳ファイル・アーカイブは除外）。進行中変更の delta 仕様も `--include-changes` で対象にでき、apply 中のチェックに使う。
- テストコード中の ID 抽出は正規表現 `\b(UT|IT)-[A-Z]{2,5}-\d{3}\b`、実装注記は `@implements\s+(REQ-[A-Z]{2,5}-\d{3})`（全言語のコメント内で可）。
- `ai-ddd trace` 出力: `docs/traceability/matrix.md`（先頭に `<!-- generated by ai-ddd trace; do not edit -->`）。`--format json` は標準出力。
- `ai-ddd verify` は `trace --check` 相当を内部呼び出しする。既存プロジェクトの段階移行のため `ai-ddd.config.json` が無いプロジェクトでは trace 検査を警告扱いとする（D10）。

### D8. 試験計画・試験仕様書
- **スキーマ**: `test-plan` 成果物（`generates: test-plan.md`、`requires: [specs, design]`）を追加し、`tasks.requires` に追加。`version: 2`。
- **`test-plan.md`（変更単位）の章立て**: Test Scope / Test Levels & Responsibilities / Environment & Test Doubles / Entry & Exit Criteria（全ケース合格・trace check 合格・C1 100%）/ Non-Functional Testing（要否と理由。詳細は後続 F10）/ Abnormal-Path Checklist（capability ごと）/ Test Case Delta（追加・変更・廃止する UT/IT ID と対応 REQ/SCN）。
- **永続試験仕様書**（変更適用時にタスクとして更新）:
  - `docs/testing/integration/<capability>.md`: 表列 = `ID | Title | Traces (SCN) | Technique | Preconditions (GIVEN) | Steps (WHEN) | Expected (THEN) | Priority | Automated Test`。末尾に Abnormal-Path Checklist 表（`Category | Case IDs | N/A Reason`）。
  - `docs/testing/unit/<layer>/<module>.md`: 表列 = `ID | Design Element | Technique | Input | Expected | Rationale (REQ/SCN/design) | Automated Test`。
- **チェックリスト検証**: `ai-ddd verify` は結合試験仕様書の Checklist 表の 7 カテゴリ行が揃い、各行で `Case IDs` か `N/A Reason` のどちらかが非空であることを検査する。
- **「カバレッジ目的化」防止**: テストファイル内の各テストケース名に UT/IT ID が無いものを違反とする。テストケースの抽出は言語別の簡易規則（TS: `test(`/`it(` の第 1 引数、Python: `def test_` + docstring/名前、Go: `func Test`/`t.Run(` の名前、Rust: `#[test] fn` 名と直前のドキュメントコメント）で行う。
- サンプルの TS テストは現状の独自 `run()` 方式から `node:test` の `test()` 単位へ分割し、1 テスト = 1 ケース ID とする（Node 22 標準のため依存ゼロを維持）。

### D9. 結合テストの異常系実現方式（サンプル）
- 外部サービスはテストハーネス内の HTTP スタブで、モード（正常 / 在庫不足 409 / 決済拒否 402 / 遅延によるタイムアウト / 接続拒否）をケースごとに切替える。
- 永続化障害はデータディレクトリを読み取り専用（または存在しないパス）で起動して再現。
- 各ケースは配布形態の実行物（docker / binary / library）に対して実行し、`drivers/` と `main` の実 I/O を検証する既存方針を維持。
- タイムアウト値はテスト用に環境変数で短縮できるよう `main` で受け取る（ドライバは分岐なしのまま、設定値を渡すだけ）。

### D10. 段階移行と互換性
- `ai-ddd verify` は `ai-ddd.config.json` の `schemaVersion` で新ルールの適用を判断する。v2 未満（設定なし含む）は新ルールを **警告** として出し、既存利用者のビルドを即座に壊さない。サンプルと新規 `init` は v2 で全ルールをエラーとして適用。
- ドリフト検出はプラットフォームリポジトリ専用スクリプト `scripts/check-drift.mjs` とし、`npm run verify:examples` から呼ぶ（利用者プロジェクト向け機能ではない）。

## Risks / Trade-offs

- [スコープが大きく 4 言語 × 多機能で作業量が多い] → タスクを「プラットフォーム（スキーマ/CLI）→ TypeScript サンプル → 他 3 言語」の順に分け、TS で規約を確定してから横展開する。各段階で `npm test` を通す。
- [正規表現ベースのテスト名・import 抽出の誤検知] → 抽出規則をサンプルとスケルトンで網羅的にテストし、既知の制約を README に記載。AST 化は F11 の後続変更。
- [翻訳の手作業負荷・陳腐化] → ハッシュ検証で陳腐化を確実に検出し、`i18n stamp` で更新を省力化。翻訳作成は AI エージェントの手順に組み込む。
- [ID の手動採番による重複] → `trace --check` で重複を検出。採番は既存最大値 + 1 を規約化し、スキルに記載。
- [ソース再配置によるサンプルの import 破壊（BREAKING）] → 言語ごとに再配置→テスト→verify を 1 タスクで完結させ、各タスクでグリーンを確認してからコミット。
- [OpenSpec の将来仕様変更で `i18n/` が成果物扱いされる可能性] → 配置規約を D2 に集約し、変更時はスキル・検証器の 1 箇所修正で済むようにする。

## Migration Plan

1. 前提: `bootstrap-ai-ddd-platform` をアーカイブし `openspec/specs/{ddd-schema,cli-installer,reference-examples}` を確立。
2. スキーマ v2・テンプレート・スキル更新 → CLI（設定・verify 拡張・trace・i18n stamp・init `--locale`）→ スケルトン。
3. TypeScript サンプル移行（構造 → ID → 試験仕様書 → 異常系結合テスト → ja 翻訳・UI）→ Python / Go / Rust へ横展開。
4. ドリフト検出導入、README 更新、全検証。
- **ロールバック**: 各タスクを 1 コミットとするため、問題のあるタスク単位で `git revert` 可能。利用者側は `schemaVersion` を上げなければ新ルールは警告のみ（D10）。

## Open Questions

- 永続試験仕様書の単位を `<layer>/<module>` より細かく（集約内のクラス単位）すべきかは、サンプル移行時のファイル行数を見て後から調整可能（規約の粒度のみで要求・タスクに影響しない）。
- `--context-code` の既定値生成規則（先頭 3 文字）で衝突が起きた場合の扱いは、1 リポジトリ = 1 コンテキストのため当面問題にならない。
