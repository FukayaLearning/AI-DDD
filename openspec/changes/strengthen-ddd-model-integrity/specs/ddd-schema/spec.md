# ddd-schema Spec Delta

## MODIFIED Requirements

### Requirement: Strategic DDD knowledge management
The `ddd-driven` schema SHALL organize specifications under `openspec/specs/<bounded-context>/<capability>/spec.md` for a single Bounded Context per repository and require synchronization with `docs/domain/ubiquitous-language.md` and `docs/domain/context-map.md`. It SHALL also require each repository to identify its Core Domain, distinguish Generic/Supporting Subdomains, and record distillation decisions, and SHALL define Shared Kernel as a model subset shared between Bounded Contexts rather than as an intra-context utility folder. The schema SHALL state that "1 Repository = 1 Bounded Context" is a platform convention, not a universal DDD rule.

#### Scenario: Cross-repository integration remains explicitly deferred
- **GIVEN** a project initialized with `ddd-driven`
- **WHEN** inspecting `docs/domain/context-map.md`
- **THEN** external repository integration protocols are recorded as `T.B.D.` while internal context boundaries and ports are documented

#### Scenario: Core Domain and distillation are recorded
- **GIVEN** a `ddd-driven` project with domain documentation
- **WHEN** the proposal and design artifacts are authored
- **THEN** they identify the Core Domain, classify external contexts as Generic or Supporting Subdomains where applicable, and record the distillation rationale in `docs/domain/context-map.md`

#### Scenario: Shared Kernel is defined as a cross-context agreement
- **GIVEN** the `ddd-driven` schema, design template, and `ddd-workflow` skill
- **WHEN** they describe `domain/shared/`
- **THEN** they describe it as shared in-context code, while Shared Kernel is defined as a model subset agreed between Bounded Contexts

### Requirement: Five-stage DDD-enriched OpenSpec schema with test planning
`ddd-driven` スキーマは `proposal`、`specs`、`design`、`test-plan`、`tasks` の 5 段階成果物グラフを定義 SHALL する。`test-plan` は `specs` と `design` に依存し、`tasks` は `specs`・`design`・`test-plan` に依存 MUST する。DDD の戦略・戦術要件と試験計画要件を成果物の instruction とテンプレートに組み込む。`design` instruction とテンプレートは、集約のカプセル化、Factory の新規生成と再構築の分離、Entity の同一性比較、値オブジェクトの不変性と自己検証、ドメインイベントのライフサイクル、および集約をまたぐ整合性の結果整合方針を必須項目として含め MUST する。

#### Scenario: Schema validates cleanly with OpenSpec CLI
- **GIVEN** `schemas/ddd-driven/` またはターゲットリポジトリの `openspec/schemas/ddd-driven/` にあるスキーマ
- **WHEN** `openspec schema validate ddd-driven` を実行する
- **THEN** OpenSpec はスキーマと 5 つのテンプレート（`proposal.md`、`spec.md`、`design.md`、`test-plan.md`、`tasks.md`）を有効と報告する

#### Scenario: Artifact dependency order includes test planning
- **GIVEN** `ddd-driven` で作成した新規変更
- **WHEN** `openspec status --change <name> --json` を実行する
- **THEN** `test-plan` の依存は `specs` と `design`、`tasks` の依存は `specs`・`design`・`test-plan` として報告される

#### Scenario: Design template demands tactical model integrity
- **GIVEN** `ddd-driven` の `design.md` テンプレートと instruction
- **WHEN** 新しい変更の設計を作成する
- **THEN** 集約の境界とカプセル化、Factory の生成/再構築分離、Entity 同一性、値オブジェクトの自己検証、イベントの発行・クリア、および補償/結果整合の方針を記述する欄が存在する

### Requirement: Schema versioning
`ddd-driven` スキーマは互換性のない成果物グラフ・テンプレート変更のたびにバージョン番号を増分 SHALL し、本変更でバージョン `4` とする。`ai-ddd verify` はターゲットに配置されたスキーマのバージョンが CLI 同梱版より古い場合に警告 SHALL する。

#### Scenario: Outdated schema copy in a target project
- **GIVEN** スキーマ `version: 3` 以下が配置されたターゲットプロジェクト
- **WHEN** CLI 同梱スキーマが `version: 4` の `ai-ddd verify --target <dir>` を実行する
- **THEN** 古いスキーマバージョンと `ai-ddd install-schema` による更新方法が警告として出力される

### Requirement: Language, structure, and traceability conventions in templates
`ddd-driven` のテンプレートと `ddd-workflow` スキルは、英語マスター＋ユーザー言語翻訳の作成規約、4 層の戦術的パターン別×集約サブフォルダ細分化規約（`domain/{entities,value_objects,services,repositories,shared}`、`application/{services,ports,dtos}`、`infrastructure/{repositories,gateways,mappers,drivers}`、`presentation/{controllers,views,i18n}`）、および `REQ`/`SCN`/`UT`/`IT` の ID 記法を明示 SHALL する。さらに、`OrderLine` のような集約内部要素を Entity と Value Object のどちらとしてモデル化するかを UL とコードで一致させ、仕様には内部クラス名・エラーコード・フレームワーク名・SQL/HTTP 詳細を記載しない規約を明示 MUST する。

#### Scenario: Templates show identifier notation
- **GIVEN** `ddd-driven` スキーマで生成した `spec.md`、`design.md`、および `test-plan.md` のテンプレート
- **WHEN** テンプレートを参照する
- **THEN** `### Requirement: REQ-<CTX>-<NNN> ...`、`#### Scenario: SCN-<CTX>-<NNN>-<NN> ...`、`UT-<CTX>-<NNN>`、`IT-<CTX>-<NNN>` の記法例と、戦術的パターン別フォルダ構成規約が含まれる

#### Scenario: Specification template forbids implementation leakage
- **GIVEN** `ddd-driven` の `spec.md` テンプレートと instruction
- **WHEN** capability の仕様を作成する
- **THEN** ドメイン語彙で観測可能な振る舞いを記述し、内部クラス名・エラーコード・フレームワーク名・SQL/HTTP 詳細を記載しないよう指示される
