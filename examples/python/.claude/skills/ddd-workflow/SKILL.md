---
name: ddd-workflow
description: End-to-end OpenSpec + DDD development workflow enforcing 1-repo-1-Bounded-Context, 5-stage schema (with test-plan), module-subdivided 4-layer architecture, Result<T, E>, 3-part Infrastructure, Mock x Playwright Web UI C1 100% coverage, traceability, localization, and 3-role multi-agent orchestration.
---

# OpenSpec × DDD Workflow Skill

Use this skill whenever designing, implementing, testing, or verifying changes in a `ddd-driven` OpenSpec repository.

## 1. Strategic & Structural Rules

1. **1 Repository = 1 Bounded Context**:
   - External Bounded Contexts live in separate repositories (cross-repo OpenSpec linking is `T.B.D.`).
   - Keep `docs/domain/ubiquitous-language.md` and `docs/domain/context-map.md` synchronized on every change.
   - Store specifications under `openspec/specs/<bounded-context>/<capability>/spec.md`.
2. **Module-Subdivided 4-Layer Architecture**:
   - **No loose source files at layer roots** (except language module declarations like `mod.rs`, `__init__.py`, `lib.rs`).
   - `domain/`: Zero outer-layer or I/O dependencies. Split into `domain/shared/` (Shared Kernel: `Result<T, E>`, base `DomainError`, shared VOs/IDs) and `domain/<aggregate>/`. **Aggregates MUST NOT directly depend on other aggregates**; reference across aggregates via IDs in `domain/shared/`.
   - `application/`: Split into `application/shared/` (ACL ports, shared DTOs) and `application/<aggregate>/{commands,queries}/`. UseCases accept Ports via DI, return `Result<T, E>`, and declare `@implements REQ-<CTX>-<NNN>`.
   - `infrastructure/`: Split strictly into:
     1. `infrastructure/drivers/<technology>/`: Raw I/O only (**NO `if`/`switch`/`match`/ternary logic allowed**).
     2. `infrastructure/persistence/<aggregate>/`: Pure Mappers + DI Repositories.
     3. `infrastructure/acl/<external-context>/`: Pure ACL translators + DI Gateways.
   - `presentation/`: Split into `presentation/<channel>/shared/`, `presentation/<channel>/<resource>/`, and `presentation/<channel>/i18n/` (MUST NOT import `infrastructure`).
   - `main`: Composition root wiring locale config, real drivers, repositories, use cases, and presentation.
   - Keep directory file counts <= `structure.maxFilesPerDirectory` (default 15; `ai-ddd verify` warns when exceeded).
3. **Result<T, E> Error Handling**:
   - Model all expected domain and infrastructure failures as typed error values inside `Result<T, E>`. Reserve exceptions/panics solely for unrecoverable bugs.

## 2. Localization (Master = `en`)

1. **Configuration (`ai-ddd.config.json`)**:
   - `locale.master` is always `"en"`. `locale.user` holds the project's user-facing locale (default `"en"`).
2. **Artifact Translation**:
   - When `locale.user` != `"en"`, author English masters first, then create translations preserving IDs, English code identifiers, and GIVEN/WHEN/THEN structure:
     - **Change artifacts** (`proposal.md`, `specs/**/spec.md`, `design.md`, `test-plan.md`): place under `openspec/changes/<change>/i18n/<locale>/<relative-path>` (never place `spec.<locale>.md` inside `openspec/changes/<change>/specs/`).
     - **Persistent docs** (`openspec/specs/**/spec.md`, `docs/domain/*.md`, `docs/testing/**/*.md`): place sibling `<basename>.<locale>.md` in the same directory.
   - After creating or updating any translation, run `ai-ddd i18n stamp --target <dir> <translation-file>` so the `<!-- ai-ddd-translation: source=<name> sha256=<hash> locale=<locale> -->` header matches the master.
   - **Translation Sync at Archive**: When archiving a change via `openspec-archive-change`, sync `i18n/<locale>/specs/**` into the corresponding `openspec/specs/**/<basename>.<locale>.md` and re-stamp.
3. **Web UI Localization**:
   - Store all UI text and `DomainError` display messages in `presentation/<channel>/i18n/` (`en` + `locale.user`), inject the active catalog from `main` (overridable via `APP_LOCALE`), and set `<html lang="<locale>">`.

## 3. Traceability & ID Numbering

1. **ID Format & Numbering**:
   - `REQ-<CTX>-<NNN>` at the start of `### Requirement:` headings.
   - `SCN-<CTX>-<NNN>-<NN>` at the start of `#### Scenario:` headings (carrying parent `REQ` number).
   - `UT-<CTX>-<NNN>` in `docs/testing/unit/<layer>/<module>.md` and unit test names.
   - `IT-<CTX>-<NNN>` in `docs/testing/integration/<capability>.md` and integration test names.
   - Always assign `max(existing) + 1`; **never reuse retired IDs**.
2. **Traceability Matrix & Check**:
   - Run `ai-ddd trace --target <dir>` to generate `docs/traceability/matrix.md` (do not hand-edit).
   - `ai-ddd trace --target <dir> --check` (also run by `ai-ddd verify`) fails on: missing heading IDs, duplicate IDs, Scenarios without IT cases, Requirements without `@implements`, test cases without automated tests, or orphan ID references.

## 4. Test Planning, Test Specifications & C1 100% Governance

- **Design-Time Test Plan (`test-plan.md`)**: Author after `specs` and `design`, before `tasks`.
- **Integration Test Specification (`docs/testing/integration/<capability>.md`)**:
  - Map every `SCN-` 1-to-1 to a normal-path `IT-` case (GIVEN/WHEN/THEN -> Preconditions/Steps/Expected).
  - Complete the 7-category **Abnormal-Path Checklist** (`Input boundary & invalid values`, `Invalid state transition`, `External dependency failure`, `Persistence / storage failure`, `Duplicate / concurrent conflict`, `Target not found`, `Locale-specific rendering`) with `IT-` case IDs or an explicit N/A reason.
  - Execute all `IT-` cases against the real distribution artifact (`docker` / `binary` / `library`) using configurable stubs and failure modes.
- **Unit Test Specification (`docs/testing/unit/<layer>/<module>.md`)**:
  - Enumerate design elements, test design technique (boundary value, equivalence partitioning, state transition, error mapping, etc.), inputs, expected results, and rationale (`REQ`/`SCN`/design).
  - Every automated test MUST carry a `UT-` or `IT-` ID; coverage-only tests without a spec ID are rejected by `ai-ddd verify`.
- **100% C1 Branch Coverage Mandatory** outside authorized exclusions (`infrastructure/drivers/` and `main` only; zero inline ignore comments; branchless `drivers/`).
- **Presentation Web UI Testing (Mock × Playwright)**:
  - Start the real Presentation HTTP server with DI-injected Mock UseCases inside the coverage-instrumented test process.
  - Drive headless Chromium (Playwright) through every normal, validation-error, domain-error, system-error, locale (`en` and `locale.user`), and not-found path, asserting DOM rendering and 100% Presentation C1 coverage.

## 5. Multi-Agent 3-Role Orchestration

1. **Main Agent (Consistent Authoring)**:
   - Owns `proposal -> specs -> design -> test-plan -> tasks`, test specs, and all 4-layer TDD implementation in a single continuous context so Ubiquitous Language and design intent stay cohesive.
2. **Execution Subagent (Lightweight / Low-Cost Model, e.g., `flash` / `flash_lite`)**:
   - Runs mechanical build, `ai-ddd verify`, `ai-ddd trace --check`, unit + browser tests, C1 coverage checks, and integration tests, returning concise failure summaries.
3. **Independent Review Subagent (High-Capability Model, e.g., `pro`, ZERO Prior Context)**:
   - Launch fresh with **no conversation history**—pass only the OpenSpec docs, `docs/domain/`, `docs/testing/`, `docs/traceability/matrix.md`, source files, and test/coverage outputs.
   - Audits spec-to-implementation fidelity, Ubiquitous Language accuracy, test specs, localization sync, `drivers/` purity, and genuine C1 100% branch coverage.

## 6. Git Branching & Per-Task Commit Discipline (`openspec-apply`)

If the project is **not** under Git version control (e.g., `git rev-parse --is-inside-work-tree` fails), omit all Git steps below. When under Git control:

1. **Pre-Task Branch Hearing & Post-Propose Commit**:
   - Before executing the first pending task in `openspec-apply`, ask the user whether to create/switch to a dedicated working branch and confirm the branch name (e.g., `feat/<change-name>`).
   - Create/checkout that branch and commit the pre-task baseline (the post-propose planning artifacts: `proposal.md`, `specs/`, `design.md`, `test-plan.md`, `tasks.md`) to the branch before starting Task 1.
2. **1-Task = 1-Commit Rule**:
   - Implement and verify tasks one at a time. Immediately after each individual task completes and its checkbox in `tasks.md` is updated from `- [ ]` to `- [x]`, commit that task's changes (including `tasks.md`) to the branch before moving to the next task.
