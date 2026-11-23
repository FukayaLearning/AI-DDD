# ddd-schema Specification

## Purpose
Defines the `ddd-driven` OpenSpec custom schema, templates, strategic DDD documentation layout, and multi-agent role separation rules for 1-repository-1-Bounded-Context development.

## Requirements

### Requirement: Strategic DDD knowledge management
The `ddd-driven` schema SHALL organize specifications under `openspec/specs/<bounded-context>/<capability>/spec.md` for a single Bounded Context per repository and require synchronization with `docs/domain/ubiquitous-language.md` and `docs/domain/context-map.md`.

#### Scenario: Cross-repository integration remains explicitly deferred
- **GIVEN** a project initialized with `ddd-driven`
- **WHEN** inspecting `docs/domain/context-map.md`
- **THEN** external repository integration protocols are recorded as `T.B.D.` while internal context boundaries and ports are documented

### Requirement: Mandatory C1 governance and multi-agent 3-role workflow
The `ddd-driven` schema SHALL enforce explicit identification of unit-test exclusions (`infrastructure/drivers/` and `main` only), 100% C1 branch coverage outside exclusions, `Result<T, E>` error modeling, and a 3-role multi-agent workflow (main agent for consistent design/implementation, lightweight execution subagent for build/test/coverage, and zero-context independent high-capability subagent for review).

#### Scenario: Design template documents test exclusions and tactical artifacts
- **GIVEN** a change created under `ddd-driven`
- **WHEN** `design.md`, `test-plan.md`, and `tasks.md` are generated from schema templates
- **THEN** `design.md` includes sections for Domain Model, 4-Layer Architecture with module layout, Infrastructure 3-part separation, and Unit-Test Exclusions, `test-plan.md` includes Test Scope, Test Levels, Environment, Entry/Exit Criteria, Abnormal-Path Checklist, and Test Case Delta, and `tasks.md` sequences Test Specification authoring, Domain TDD, Infrastructure abnormal-path TDD, Application Scenario TDD, Presentation Mock+Browser TDD, Integration Test, Traceability Check, Translation Sync, and Zero-Context Review

### Requirement: Git branch and per-task commit workflow during apply
When the target project is under Git version control, the `ddd-driven` schema and `ddd-workflow` skill SHALL instruct `openspec-apply` to consult the user on working-branch creation and commit post-propose planning artifacts before the first task, and create one commit per completed task; non-Git projects SHALL omit these Git steps.

#### Scenario: Git workflow applies only to Git-managed repositories
- **GIVEN** a change ready for `openspec-apply` under the `ddd-driven` schema
- **WHEN** evaluating Git management instructions before and during task execution
- **THEN** Git-managed repositories prompt for branch creation and commit post-propose artifacts first followed by one commit per completed task, while non-Git repositories skip Git operations

### Requirement: Default OpenSpec skill routing via AGENTS.md
The repository root and `ai-ddd init` generated projects SHALL provide an `AGENTS.md` instruction file that translates change requests into OpenSpec skill workflows (`openspec-explore`, `openspec-propose`, `openspec-update-change`, `openspec-apply-change`, `openspec-sync-specs`, `openspec-archive-change`) by default, permitting direct file edits only when the user explicitly instructs to omit OpenSpec.

#### Scenario: Direct edits require explicit OpenSpec opt-out
- **GIVEN** a repository containing the generated or root `AGENTS.md`
- **WHEN** a user requests a code or documentation change without naming an OpenSpec skill or explicitly opting out
- **THEN** the agent routes the request through the matching OpenSpec skill workflow and performs direct file edits without OpenSpec only upon an explicit user opt-out instruction

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
`ddd-driven` スキーマは互換性のない成果物グラフ・テンプレート変更のたびにバージョン番号を増分 SHALL し、本変更でバージョン `3` とする。`ai-ddd verify` はターゲットに配置されたスキーマのバージョンが CLI 同梱版より古い場合に警告 SHALL する。

#### Scenario: Outdated schema copy in a target project
- **GIVEN** スキーマ `version: 2` 以下が配置されたターゲットプロジェクト
- **WHEN** CLI 同梱スキーマが `version: 3` の `ai-ddd verify --target <dir>` を実行する
- **THEN** 古いスキーマバージョンと `ai-ddd install-schema` による更新方法が警告として出力される

### Requirement: Language, structure, and traceability conventions in templates
`ddd-driven` のテンプレートと `ddd-workflow` スキルは、英語マスター＋ユーザー言語翻訳の作成規約、4 層の戦術的パターン別×集約サブフォルダ細分化規約（`domain/{entities,value_objects,services,repositories,shared}`、`application/{services,ports,dtos}`、`infrastructure/{repositories,gateways,mappers,drivers}`、`presentation/{controllers,views,i18n}`）、および `REQ`/`SCN`/`UT`/`IT` の ID 記法を明示 SHALL する。

#### Scenario: Templates show identifier notation
- **GIVEN** `ddd-driven` スキーマで生成した `spec.md`、`design.md`、および `test-plan.md` のテンプレート
- **WHEN** テンプレートを参照する
- **THEN** `### Requirement: REQ-<CTX>-<NNN> ...`、`#### Scenario: SCN-<CTX>-<NNN>-<NN> ...`、`UT-<CTX>-<NNN>`、`IT-<CTX>-<NNN>` の記法例と、戦術的パターン別フォルダ構成規約が含まれる
