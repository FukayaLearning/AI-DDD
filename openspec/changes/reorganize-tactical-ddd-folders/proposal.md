# Proposal

## Why

現在の 4 層アーキテクチャのフォルダ構成（`domain/{shared,<aggregate>}` など）では、エリック・エヴァンスの『ドメイン駆動設計』第 5 章・第 6 章で定義される戦術的設計の構成要素（エンティティ、値オブジェクト、サービス、リポジトリ）がフォルダ階層として明示的に整理されておらず、1 つの集約フォルダやファイルの中に複数のパターン要素が混在している。
4 層すべての第 2 階層を「DDD の戦術的パターン／役割種別フォルダ」、第 3 階層を「集約（またはリソース・外部コンテキスト・技術）単位のサブフォルダ」に統一することで、DDD 書籍の概念とソースコードのディレクトリ構造を 1 対 1 で対応させ、凝集度と静的ガバナンス検証（`ai-ddd verify`）の厳密性を向上させる。

## What Changes

- **BREAKING**: `domain/` 層のフォルダ構造を `domain/{entities,value_objects,services,repositories}/<aggregate|shared>/` および `domain/shared/`（`Result<T, E>`・`DomainError` 等の言語共通基底のみ）に再編する。
- **BREAKING**: `application/` 層のフォルダ構造を `application/{services,ports,dtos}/<aggregate|shared>/` に再編する（旧 `application/<aggregate>/{commands,queries}` を廃止）。
- **BREAKING**: `infrastructure/` 層のフォルダ構造を `infrastructure/{repositories,gateways,mappers,drivers}/<aggregate|external-context|technology>/` に再編する（旧 `persistence` / `acl` を、純粋変換 `mappers` と DI 実装 `repositories` / `gateways` に明確に分離）。
- **BREAKING**: `presentation/` 層のフォルダ構造を `presentation/{controllers,views,i18n}/<resource|shared>/` に再編する（旧 `presentation/<channel>/<resource>` からルーティング制御 `controllers` と HTML 描画 `views` を分離）。
- **BREAKING**: `ai-ddd verify` に各層の第 2 階層パターンフォルダ名ホワイトリスト検証、パターンフォルダ直下の未分類ファイル禁止検証、および新構造に対応した集約間独立性検証（`domain/{entities,value_objects,services,repositories}/<aggA>/` から他集約 `<aggB>` への直接依存禁止）を実装する。
- `ddd-driven` スキーマ（`version: 3` へ更新）、テンプレート群、`skills/ddd-workflow/SKILL.md`、`ai-ddd init` の 4 言語スケルトン生成器（`src/skeletons/*.js`）、および 4 言語のリファレンス実装（`examples/{typescript,python,go,rust}/`）を新フォルダ構成に完全同期する。

## Capabilities

### New Capabilities

（なし）

### Modified Capabilities

- `source-structure`: 4 層すべての第 2 階層（戦術的パターン／役割フォルダ）と第 3 階層（集約／モジュールフォルダ）のレイアウト要件、第 1・第 2 階層での直下ファイル禁止要件、許可されたパターンフォルダ名の静的検証要件、およびパターン横断の集約間依存禁止要件を更新する。
- `ddd-schema`: `ddd-driven` スキーマ（`version: 3`）およびテンプレート・`ddd-workflow` スキルに記載される 4 層フォルダ構成規約を更新する。
- `reference-examples`: 4 言語のリファレンス実装（`examples/{typescript,python,go,rust}/`）のモジュール細分化構造の要件を新しい戦術的パターン別フォルダ構成に更新する。

## Impact

- `schemas/ddd-driven/schema.yaml` および `schemas/ddd-driven/templates/*.md`
- `skills/ddd-workflow/SKILL.md` および `.agents/` / `.claude/` / `.github/` 配下の配布スキル
- `src/verifier.js`（層・パターンフォルダ検証、集約分離検証、ドライバ分岐禁止検証）
- `src/i18n.js`（`presentation/i18n/` カタログ検出パス）
- `src/skeletons/{typescript,python,go,rust,common_docs}.js`
- `examples/{typescript,python,go,rust}/` の全ソースコード・テスト・トレーサビリティマトリクス・設計ドキュメントおよび翻訳ファイル
- `tests/` 配下のプラットフォーム単体テスト
