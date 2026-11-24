# Proposal

## Why

エリック・エヴァンス『ドメイン駆動設計』との照合点検で、4 言語のリファレンス実装とプラットフォームのスキーマ・検証 CLI に、構造面では良好ながら**モデルの意味**に関わる乖離が確認された。特に、Go/Rust の集約・値オブジェクトの全フィールド公開、全言語共通のドメインイベント未発行、Factory の生成と再構築の混同、確定処理の整合性境界の破綻、Core Domain / 蒸留の不在、および `ai-ddd verify` が DDD の意味的整合性を検証しない点が重大である。

本変更は、参照実装・スキーマ・検証 CLI を一貫して修正し、「verify が通る＝DDD 準拠」ではなく「モデルの不変条件とユビキタス言語が実際に守られている」状態へ引き上げる。

## What Changes

- **BREAKING**: 4 言語の集約ルートと値オブジェクトをカプセル化する。Go/Rust はフィールドを非公開化し、Python はコンストラクタを非公開化し、TypeScript は値オブジェクトをブランド型またはクラス化して構造的偽造を防ぐ。
- **BREAKING**: ドメインイベントに `pullEvents()` / `clearEvents()` と Application 層 `DomainEventPublisher` ポートを導入し、永続化（`save`）成功後にイベントを発行・クリアする。マッパーはイベントを永続化レコードに含めない（record-only ではなく発行経路を全言語で実装する）。
- **BREAKING**: `Order.create` を「新規生成（`Draft` 固定、`version = 0`、イベント空）」と「再構築（`reconstitute`、ID/`status`/`version` 受領・不変条件検証）」に分離し、遷移を経ない `Confirmed`/`Cancelled` 集約の新規生成を禁止する。
- **BREAKING**: Entity の等価性を `OrderId` による同一性比較で定義する（Python `__eq__`、Rust `PartialEq`、Go `Equals`、TypeScript `equals`）。
- **BREAKING**: 確定処理を遷移後の集約で実行し、外部副作用（在庫予約・決済）の補償・冪等キー・結果整合の方針を設計する。`Confirmed` 取消時の在庫解放・返金も仕様化する。
- `OrderLine` を「集約内の値オブジェクト（またはローカルエンティティ）」として UL と設計書で再分類し、ACL ポートには DTO を渡す。
- `DomainError` をドメイン不変条件違反とインフラ障害で分離し、ドメイン語彙から `REPOSITORY_ERROR` 等のインフラ都合コードを排除する。
- `totalAmount()` を `Result` 化し、値オブジェクト演算（`addMoney`）経由に統一する。`multiplyMoney` のオーバーフロー検査を追加する。
- Presentation に `canConfirm` / `canCancel` を追加して状態遷移ルールの重複を解消し、入力変換の失敗を `Result` チャネルに乗せる。Web UI で複数明細（1〜5 行）を入力可能にする。
- 楽観的並行性制御（version）と保存時の競合検出を全言語に追加する。
- `ddd-driven` スキーマ・テンプレート・`ddd-workflow` スキルに、Core Domain / Generic Subdomain / Distillation、Shared Kernel の正しい定義、集約カプセル化、Factory の生成/再構築分離、値オブジェクトの自己検証、Entity 同一性、イベントライフサイクル、仕様からの実装詳細排除を明記する。`domain/shared/` の "Shared Kernel" 表記を修正し、1 Repository = 1 Bounded Context が Evans の原則ではなくプラットフォーム規約であることを明記する。
- `ai-ddd verify` に、UL 用語とコード識別子の一致、集約フィールドの非公開性、値オブジェクトの検証経路、イベント発行経路、`OrderLine` の分類整合など、モデル整合性の静的ヒューリスティック検証を追加する。
- `ai-ddd trace` に、Scenario ↔ UseCase の 1-to-1 対応検証を追加する。
- 参照実装のアーカイブ成果物に `test-plan.md`、`REQ-`/`SCN-` ID、`i18n/ja/` を追補し、schema v4 に適合させる（教材としての完全性のための整備であり、履歴の改変ではない）。
- README のレイヤ構成・schema バージョン表記を実体に合わせる。

## Capabilities

### New Capabilities

（なし）

### Modified Capabilities

- `ddd-schema`: 戦略的蒸留（Core Domain / Generic Subdomain / Distillation）、Shared Kernel の定義修正、戦術的モデル整合性（集約カプセル化、Factory 分離、Entity 同一性、値オブジェクト自己検証、イベントライフサイクル）、および仕様の実装詳細排除を schema・テンプレート・スキルに追加する。
- `reference-examples`: 4 言語のリファレンス実装のモデル意味論（集約カプセル化、Factory 再構築、Entity 同一性、イベント発行、確定フロー整合性、楽観的並行性制御、エラー分離、VO 自己検証、OrderLine 分類、UL 整合、仕様の実装詳細排除、アーカイブの schema v4 適合）を更新する。
- `cli-installer`: `ai-ddd verify` に DDD モデル整合性の静的検証を追加する。
- `traceability`: `ai-ddd trace --check` に Scenario ↔ UseCase の 1-to-1 対応検証を追加する。
- `test-specification`: 集約不変条件・イベント発行・値オブジェクト検証・集約カプセル化を検証する試験ケースを必須化する。

## Impact

- `schemas/ddd-driven/schema.yaml` および `schemas/ddd-driven/templates/*.md`
- `skills/ddd-workflow/SKILL.md` および `.agents/` / `.claude/` / `.github/` / `.hermes/` 配下の配布スキル
- `src/verifier.js`、`src/tracer.js`、`src/test-spec.js`、`tests/` 配下のプラットフォーム単体テスト
- `examples/{typescript,python,go,rust}/` の全ソースコード・テスト・ドメイン文書・仕様・設計書・トレーサビリティマトリクス・アーカイブ成果物
- `README.md`
- 各リファレンス実装の `openspec/schemas/ddd-driven/` コピー（`npm run verify:examples` のドリフト検査対象）
