# Spec Delta

## ADDED Requirements

### Requirement: Five-stage DDD-enriched OpenSpec schema with test planning
`ddd-driven` スキーマは `proposal`、`specs`、`design`、`test-plan`、`tasks` の 5 段階成果物グラフを定義 SHALL する。`test-plan` は `specs` と `design` に依存し、`tasks` は `specs`・`design`・`test-plan` に依存 MUST する。DDD の戦略・戦術要件と試験計画要件を成果物の instruction とテンプレートに組み込む。

#### Scenario: Schema validates cleanly with OpenSpec CLI
- **GIVEN** `schemas/ddd-driven/` またはターゲットリポジトリの `openspec/schemas/ddd-driven/` にあるスキーマ
- **WHEN** `openspec schema validate ddd-driven` を実行する
- **THEN** OpenSpec はスキーマと 5 つのテンプレート（`proposal.md`、`spec.md`、`design.md`、`test-plan.md`、`tasks.md`）を有効と報告する

#### Scenario: Artifact dependency order includes test planning
- **GIVEN** `ddd-driven` で作成した新規変更
- **WHEN** `openspec status --change <name> --json` を実行する
- **THEN** `test-plan` の依存は `specs` と `design`、`tasks` の依存は `specs`・`design`・`test-plan` として報告される

### Requirement: Schema versioning
`ddd-driven` スキーマは互換性のない成果物グラフ・テンプレート変更のたびにバージョン番号を増分 SHALL し、本変更でバージョン `2` とする。`ai-ddd verify` はターゲットに配置されたスキーマのバージョンが CLI 同梱版より古い場合に警告 SHALL する。

#### Scenario: Outdated schema copy in a target project
- **GIVEN** スキーマ `version: 1` が配置されたターゲットプロジェクト
- **WHEN** CLI 同梱スキーマが `version: 2` の `ai-ddd verify --target <dir>` を実行する
- **THEN** 古いスキーマバージョンと `ai-ddd install-schema` による更新方法が警告として出力される

### Requirement: Language, structure, and traceability conventions in templates
`ddd-driven` のテンプレートと `ddd-workflow` スキルは、英語マスター＋ユーザー言語翻訳の作成規約、層内モジュール細分化規約、`REQ`/`SCN`/`UT`/`IT` の ID 記法を明示 SHALL する。

#### Scenario: Templates show identifier notation
- **GIVEN** `ddd-driven` スキーマで生成した `spec.md` と `test-plan.md` のテンプレート
- **WHEN** テンプレートを参照する
- **THEN** `### Requirement: REQ-<CTX>-<NNN> ...`、`#### Scenario: SCN-<CTX>-<NNN>-<NN> ...`、`UT-<CTX>-<NNN>`、`IT-<CTX>-<NNN>` の記法例が含まれる

## MODIFIED Requirements

### Requirement: Mandatory C1 governance and multi-agent 3-role workflow
The `ddd-driven` schema SHALL enforce explicit identification of unit-test exclusions (`infrastructure/drivers/` and `main` only), 100% C1 branch coverage outside exclusions, `Result<T, E>` error modeling, and a 3-role multi-agent workflow (main agent for consistent design/implementation, lightweight execution subagent for build/test/coverage, and zero-context independent high-capability subagent for review).

#### Scenario: Design template documents test exclusions and tactical artifacts
- **GIVEN** a change created under `ddd-driven`
- **WHEN** `design.md`, `test-plan.md`, and `tasks.md` are generated from schema templates
- **THEN** `design.md` includes sections for Domain Model, 4-Layer Architecture with module layout, Infrastructure 3-part separation, and Unit-Test Exclusions, `test-plan.md` includes Test Scope, Test Levels, Environment, Entry/Exit Criteria, Abnormal-Path Checklist, and Test Case Delta, and `tasks.md` sequences Test Specification authoring, Domain TDD, Infrastructure abnormal-path TDD, Application Scenario TDD, Presentation Mock+Browser TDD, Integration Test, Traceability Check, Translation Sync, and Zero-Context Review

## REMOVED Requirements

### Requirement: Four-stage DDD-enriched OpenSpec schema
**Reason**: 設計段階で試験計画を立案するため `test-plan` 成果物を追加し 5 段階化する。
**Migration**: 「Five-stage DDD-enriched OpenSpec schema with test planning」要求に置き換える。既存プロジェクトは `ai-ddd install-schema` でスキーマ v2 を再配置し、進行中の変更には `test-plan.md` を追加する。
