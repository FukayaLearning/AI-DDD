# Design

## Strategic DDD Alignment

- **Bounded Context**: `<bounded-context>`
- **Core Domain & Subdomains**: <!-- Core Domain owned here; Generic/Supporting Subdomains and their external contexts -->
- **Distillation**: <!-- Why the Core Domain is separated from Generic/Supporting Subdomains; any Segregated Core / Cohesive Mechanism decisions -->
- **Ubiquitous Language Updates**: Synced to `docs/domain/ubiquitous-language.md`
- **Context Map & External Integration**: Synced to `docs/domain/context-map.md` (Customer/Supplier direction and downstream ACL documented separately; cross-repo OpenSpec linking: `T.B.D.`)
- **Shared Kernel**: <!-- Model subset agreed between Bounded Contexts; `domain/shared/` is shared in-context code, not a Shared Kernel -->

## Tactical Domain Model (`domain/`)

- **Value Objects**: <!-- Immutable, self-validating types returning Result<T, DomainError>; construction cannot bypass validation -->
- **Entities & Aggregate Roots**: <!-- Aggregate boundary, invariants, state transitions -->
- **Aggregate Encapsulation**: <!-- How aggregate/value-object state is hidden; which behavior and read-only accessors are exposed -->
- **Factory: Create vs Reconstitute**: <!-- `create` initializes new aggregates only; `reconstitute` accepts persisted state and validates invariants -->
- **Entity Identity**: <!-- How entity equality is defined by identity (ID), not all attributes -->
- **Value Object Validation**: <!-- How each value object enforces immutability and invariants at construction -->
- **Domain Events**: <!-- Events recorded on aggregate state changes -->
- **Domain Event Lifecycle**: <!-- pull/clear after save + publisher port, or explicit record-only policy; mapper must not persist transient events -->
- **Cross-Aggregate Consistency & Compensation**: <!-- One aggregate per transaction; external side-effect compensation, idempotency keys, post-transition aggregate use -->
- **Optimistic Concurrency**: <!-- Aggregate version and repository conflict detection -->
- **Domain & Application Ports (Interfaces)**: <!-- OrderRepository owned by domain/repositories/<aggregate>/; external ACL Ports owned by application/ports/<external-or-shared>/ -->
- **Error Modeling (`Result<T, E>`)**: <!-- DomainError (invariants) separated from InfrastructureError (storage/external); no domain exceptions -->

## 4-Layer Architecture, Module Layout & Infrastructure 3-Part Separation

- **Dependency Rule**: `presentation -> application -> domain <- infrastructure`; `presentation` MUST NOT import `infrastructure`; `main` wires DI.
- **Tactical-Pattern x Aggregate Layer Layout** (uniform 3-level `<layer>/<tactical-pattern>/<aggregate-or-module>/`; no loose source files at layer roots or directly under pattern folders; aggregate isolation inside `domain/`):
  - `domain/shared/` (shared in-context code: `Result`, base `DomainError` only) & `domain/{entities,value_objects,services,repositories}/<aggregate>/` (shared VOs/IDs in `domain/value_objects/shared/`)
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
