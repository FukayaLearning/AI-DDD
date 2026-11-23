# Design

## Strategic DDD Alignment

- **Bounded Context**: `<bounded-context>`
- **Ubiquitous Language Updates**: Synced to `docs/domain/ubiquitous-language.md`
- **Context Map & External Integration**: Synced to `docs/domain/context-map.md` (cross-repo OpenSpec linking: `T.B.D.`)

## Tactical Domain Model (`domain/`)

- **Value Objects**: <!-- Immutable validated types returning Result<T, DomainError> -->
- **Entities & Aggregate Roots**: <!-- Aggregate boundary, invariants, state transitions -->
- **Domain Events**: <!-- Events emitted on aggregate state changes -->
- **Domain & Application Ports (Interfaces)**: <!-- OrderRepository owned by domain/repositories/<aggregate>/; external ACL Ports owned by application/ports/<external-or-shared>/ -->
- **Error Modeling (`Result<T, E>`)**: <!-- Exhaustive DomainError variants (no domain exceptions) -->

## 4-Layer Architecture, Module Layout & Infrastructure 3-Part Separation

- **Dependency Rule**: `presentation -> application -> domain <- infrastructure`; `presentation` MUST NOT import `infrastructure`; `main` wires DI.
- **Tactical-Pattern x Aggregate Layer Layout** (uniform 3-level `<layer>/<tactical-pattern>/<aggregate-or-module>/`; no loose source files at layer roots or directly under pattern folders; aggregate isolation inside `domain/`):
  - `domain/shared/` (Shared Kernel: `Result`, base `DomainError` only) & `domain/{entities,value_objects,services,repositories}/<aggregate>/` (shared VOs/IDs in `domain/value_objects/shared/`)
  - `application/{services,ports,dtos}/<aggregate|shared>/`
  - `infrastructure/repositories/<aggregate>/`, `infrastructure/gateways/<external-context>/`, `infrastructure/mappers/<aggregate|external-context>/`, `infrastructure/drivers/<technology>/`
  - `presentation/controllers/<resource>/`, `presentation/views/<resource>/`, `presentation/i18n/` (`en` + user locale catalogs)
- **Infrastructure Split**:
  1. **Pure Mappers & ACL Converters (`infrastructure/mappers/`)**: Side-effect free transformations (100% C1 unit-testable without mocks).
  2. **Minimal Drivers (`infrastructure/drivers/`)**: Raw DB/HTTP I/O ONLY. Zero `if`/`switch`/`match`/ternary business or error-mapping branches allowed.
  3. **Repositories (`infrastructure/repositories/`) & Gateways (`infrastructure/gateways/`)**: Accept driver interfaces via DI, convert driver failures/timeouts/conflicts into `Result<T, E>` (100% C1 unit-testable via mock drivers).
- **Presentation (`presentation/`)**: `controllers/` (HTTP routing, request interpretation, UseCase invocation) and `views/` (HTML SSR rendering) accept Application UseCases via DI; verified via Mock UseCase + Playwright/Headless Chromium for 100% C1 coverage.

## Unit-Test Exclusions & C1 100% Coverage Governance

- **Target outside exclusions**: **100% C1 (branch) coverage mandatory**.
- **Inline ignore directives**: Strictly forbidden across all source files.
- **Authorized Exclusions (configured centrally in one config file)**:
  - `infrastructure/drivers/*`: Raw external I/O adapters (branchless; verified in Integration Tests).
  - `main`: Composition root / DI bootstrap (verified in Integration Tests).

## Distribution & Integration Test Plan

- **Distribution Mode**: `docker` | `binary` | `library`
- **Integration Verification**: <!-- How drivers/ and main are verified end-to-end under the target distribution mode -->
