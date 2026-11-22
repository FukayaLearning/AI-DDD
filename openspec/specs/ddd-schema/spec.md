# ddd-schema Specification

## Purpose
Defines the `ddd-driven` OpenSpec custom schema, templates, strategic DDD documentation layout, and multi-agent role separation rules for 1-repository-1-Bounded-Context development.

## Requirements

### Requirement: Four-stage DDD-enriched OpenSpec schema
The `ddd-driven` schema SHALL preserve OpenSpec's four-stage artifact graph (`proposal`, `specs`, `design`, `tasks`) while embedding DDD strategic and tactical requirements into artifact instructions and templates.

#### Scenario: Schema validates cleanly with OpenSpec CLI
- **GIVEN** the `ddd-driven` schema directory under `schemas/ddd-driven/` or a target repository's `openspec/schemas/ddd-driven/`
- **WHEN** `openspec schema validate ddd-driven` is executed
- **THEN** OpenSpec reports the schema and all four templates (`proposal.md`, `spec.md`, `design.md`, `tasks.md`) as valid

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
- **WHEN** `design.md` and `tasks.md` are generated from schema templates
- **THEN** `design.md` includes sections for Domain Model, 4-Layer Architecture, Infrastructure 3-part separation, Unit-Test Exclusions, and Integration Test Plan, and `tasks.md` sequences Domain TDD, Infrastructure abnormal-path TDD, Application Scenario TDD, Presentation Mock+Browser TDD, Integration Test, and Zero-Context Review

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
