---
name: ddd-workflow
description: End-to-end OpenSpec + DDD development workflow enforcing 1-repo-1-Bounded-Context, 4-layer architecture, Result<T, E>, 3-part Infrastructure separation, Mock x Playwright Web UI C1 100% coverage, and 3-role multi-agent orchestration.
---

# OpenSpec × DDD Workflow Skill

Use this skill whenever designing, implementing, testing, or verifying changes in a `ddd-driven` OpenSpec repository.

## 1. Strategic & Structural Rules

1. **1 Repository = 1 Bounded Context**:
   - External Bounded Contexts live in separate repositories (cross-repo OpenSpec linking is `T.B.D.`).
   - Keep `docs/domain/ubiquitous-language.md` and `docs/domain/context-map.md` synchronized on every change.
   - Store specifications under `openspec/specs/<bounded-context>/<capability>/spec.md`.
2. **Layer-First 4-Layer Architecture**:
   - `domain/`: Zero outer-layer or I/O dependencies. Value Objects, Entities, Aggregates, Domain Events, Ports, `Result<T, E>`, `DomainError`.
   - `application/`: UseCases accepting Ports via DI, returning `Result<T, E>`. Scenarios in `spec.md` map 1-to-1 to UseCase tests.
   - `infrastructure/`: Split strictly into:
     1. Pure Mappers / ACL converters (side-effect free, 100% C1 unit-tested without mocks).
     2. Minimal `drivers/` (raw I/O only; **NO `if`/`switch`/`match`/ternary logic allowed**).
     3. Repositories / Gateways (inject driver interfaces via DI; unit-test all abnormal paths via mock drivers to 100% C1).
   - `presentation/`: Web UI / SSR handlers accepting Application UseCases via DI (MUST NOT import `infrastructure`).
   - `main`: Composition root wiring real drivers, repositories, use cases, and presentation.
3. **Result<T, E> Error Handling**:
   - Model all expected domain and infrastructure failures as typed error values inside `Result<T, E>`. Reserve exceptions/panics solely for unrecoverable bugs.

## 2. C1 (Branch) 100% Coverage & Exclusion Governance

- **100% C1 Branch Coverage Mandatory** outside authorized exclusions.
- **3 Governance Rules** (verified by `ai-ddd verify`):
  1. **No Inline Ignore Comments**: `istanbul ignore`, `v8 ignore`, `c8 ignore`, `pragma: no cover`, `#[coverage(off)]` are strictly forbidden in source code.
  2. **Fixed Exclusion Scope**: Only `infrastructure/drivers/` and `main` may be excluded in central coverage config.
  3. **Branchless Drivers**: `infrastructure/drivers/` MUST NOT contain conditional branching; real I/O & `main` wiring are tested in **Distribution Integration Tests** (`docker`, `binary`, or `library`).
- **Presentation Web UI Testing (Mock × Playwright)**:
  - Start the real Presentation HTTP server with DI-injected Mock UseCases inside the coverage-instrumented test process.
  - Drive headless Chromium (Playwright) through every normal, validation-error, domain-error, system-error, and not-found path, asserting DOM rendering and 100% Presentation C1 coverage.

## 3. Multi-Agent 3-Role Orchestration

1. **Main Agent (Consistent Authoring)**:
   - Owns `proposal -> specs -> design -> tasks` and all 4-layer TDD implementation in a single continuous context so Ubiquitous Language and design intent stay cohesive.
2. **Execution Subagent (Lightweight / Low-Cost Model, e.g., `flash` / `flash_lite`)**:
   - Runs mechanical build, `ai-ddd verify`, unit + browser tests, C1 coverage checks, and integration tests, returning concise failure summaries.
3. **Independent Review Subagent (High-Capability Model, e.g., `pro`, ZERO Prior Context)**:
   - Launch fresh with **no conversation history**—pass only the OpenSpec docs, `docs/domain/`, source files, and test/coverage outputs.
   - Audits spec-to-implementation fidelity, Ubiquitous Language accuracy, `drivers/` purity, and genuine C1 100% branch coverage.

## 4. Git Branching & Per-Task Commit Discipline (`openspec-apply`)

If the project is **not** under Git version control (e.g., `git rev-parse --is-inside-work-tree` fails), omit all Git steps below. When under Git control:

1. **Pre-Task Branch Hearing & Post-Propose Commit**:
   - Before executing the first pending task in `openspec-apply`, ask the user whether to create/switch to a dedicated working branch and confirm the branch name (e.g., `feat/<change-name>`).
   - Create/checkout that branch and commit the pre-task baseline (the post-propose planning artifacts: `proposal.md`, `specs/`, `design.md`, `tasks.md`) to the branch before starting Task 1.
2. **1-Task = 1-Commit Rule**:
   - Implement and verify tasks one at a time. Immediately after each individual task completes and its checkbox in `tasks.md` is updated from `- [ ]` to `- [x]`, commit that task's changes (including `tasks.md`) to the branch before moving to the next task.
