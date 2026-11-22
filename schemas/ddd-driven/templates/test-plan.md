# Test Plan

## Test Scope

- **Capabilities**: `<bounded-context>/<capability>`
- **Requirements / Scenarios**: `REQ-<CTX>-<NNN>`, `SCN-<CTX>-<NNN>-<NN>`
- **Design Elements**: <!-- Domain VOs/Aggregates, Mappers, Repositories/Gateways, UseCases, Presentation views -->
- **Out of Scope**: <!-- Explicitly excluded items and rationale -->

## Test Levels & Responsibilities

- **Unit Tests (`UT-<CTX>-<NNN>`)**:
  - `domain/`: Value Objects, Aggregate invariants, `Result<T, E>` error branches, Domain Events
  - `infrastructure/persistence/`, `infrastructure/acl/`: Pure Mappers & Repositories/Gateways via mock drivers
  - `application/`: UseCases via mock ports (1-to-1 with Scenarios)
  - `presentation/`: Mock UseCase + Headless Chromium / Playwright UI & locale branches
- **Integration / E2E Tests (`IT-<CTX>-<NNN>`)**:
  - Executed against real distribution artifact (`docker` | `binary` | `library`) verifying `infrastructure/drivers/` and `main` wiring, normal Scenarios, and abnormal paths.

## Environment & Test Doubles

- **Unit Test Doubles**: <!-- Mock drivers, mock ports, mock UseCases -->
- **Integration Test Environment**: <!-- Distribution artifact, external service stubs (normal/error/timeout modes), storage failure setup -->

## Entry & Exit Criteria

- **Entry Criteria**: `specs`, `design`, and `test-plan` reviewed; target environment builds cleanly.
- **Exit Criteria** (ALL mandatory):
  1. All `UT-` and `IT-` test cases pass.
  2. `ai-ddd trace --check` passes with zero gaps or orphan references.
  3. 100% C1 (branch) coverage outside authorized exclusions (`infrastructure/drivers/` and `main`), verified by `ai-ddd verify`.

## Non-Functional Testing

- **Required?**: `No` | `Yes`
- **Rationale / Scope**: <!-- Performance, security, availability considerations if applicable -->

## Abnormal-Path Checklist

| Category | Case IDs | N/A Reason |
| :--- | :--- | :--- |
| Input boundary & invalid values | | |
| Invalid state transition | | |
| External dependency failure (timeout / declined / unavailable) | | |
| Persistence / storage failure | | |
| Duplicate / concurrent conflict | | |
| Target not found | | |
| Locale-specific rendering | | |

## Test Case Delta

| Case ID | Level | Action (`Add`/`Modify`/`Retire`) | Traces (`REQ`/`SCN`/Design) | Technique | Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `UT-<CTX>-001` | Unit | Add | `REQ-<CTX>-001` | Boundary value | |
| `IT-<CTX>-001` | Integration | Add | `SCN-<CTX>-001-01` | Scenario E2E | |
