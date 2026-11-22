# Spec Delta

## Purpose

Defines the `ddd-driven` OpenSpec custom schema, templates, strategic DDD documentation layout, and multi-agent role separation rules for 1-repository-1-Bounded-Context development.

## ADDED Requirements

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
