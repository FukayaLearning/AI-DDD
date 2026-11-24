# Design

## Strategic DDD Alignment

- **Bounded Context**: `ordering`
- **Core Domain**: `ordering`; `inventory` / `payment` are Generic/Supporting Subdomains in separate repositories.
- **Distillation**: order lifecycle and invariants are the differentiating core; external contexts are isolated behind ACL ports.
- **Ubiquitous Language Updates**: Synced to `docs/domain/ubiquitous-language.md`.
- **Context Map & External Integration**: Synced to `docs/domain/context-map.md` (Customer/Supplier direction and downstream ACL; cross-repo OpenSpec linking: `T.B.D.`).
- **Shared Kernel**: none currently; `domain/shared/` is shared in-context code, not a Shared Kernel.

## Tactical Domain Model (`domain/`)

- **Value Objects**: `OrderId`, `CustomerId`, `ProductId`, `Money` (`JPY` | `USD`, `add`, `multiply`) in `domain/value_objects/shared/`; `Quantity` (1..100) in `domain/value_objects/order/`. All are immutable, self-validating classes/factories that reject direct invalid construction.
- **Entities & Aggregate Roots**: `Order` aggregate root (`Draft` | `Confirmed` | `Cancelled`) in `domain/entities/order/`. `OrderLine` is an aggregate-internal Value Object. Invariants: 1..5 lines, no duplicate `ProductId`, single currency across lines, `confirm()` only from `Draft`, `cancel()` forbidden from `Cancelled`.
- **Aggregate Encapsulation**: state is private; behavior and read-only accessors are exposed. External code cannot assign status or replace lines.
- **Factory: Create vs Reconstitute**: `Order.create` always initializes `Draft`, `version = 0`, and empty events; `Order.reconstitute` accepts persisted status/version and validates invariants.
- **Entity Identity**: `Order` equality is defined by `OrderId` only; value objects use attribute equality.
- **Value Object Validation**: value objects validate invariants in their constructors and factories; `Order.create`/`reconstitute` also reject forged line values.
- **Domain Events**: `OrderConfirmedEvent`, `OrderCancelledEvent`; `pullEvents()`/`clearEvents()` expose a transient event lifecycle.
- **Domain Event Lifecycle**: the application publishes pulled events through `DomainEventPublisher` after a successful save; the mapper does not persist transient events.
- **Cross-Aggregate Consistency & Compensation**: confirmation reserves stock, charges payment, saves, then publishes; failures release stock or refund payment. Cancellation of a confirmed order releases stock and refunds before saving. `orderId` is the idempotency key.
- **Optimistic Concurrency**: `Order.version` is persisted and repositories reject stale saves with `CONFLICT`.
- **Domain Ports**: `OrderRepository` in `domain/repositories/order/`; `InventoryPort`, `PaymentPort`, and `DomainEventPublisher` in `application/ports/{inventory,payment,events}/`.
- **Error Modeling**: `DomainError` (invariant violations) is separated from `InfrastructureError` (storage/external failures); use cases return `Result<T, OrderError>`.

## 4-Layer Architecture & Infrastructure 3-Part Separation

- **Dependency Rule**: `presentation -> application -> domain <- infrastructure`; `presentation` never imports `infrastructure`; `main.ts` wires DI.
- **Infrastructure Split**:
  1. **Pure Mapper (`infrastructure/mappers/order/order_mapper.ts`)**: `toRecord` / `fromRecord` pure transformations tested without mocks; no event persistence.
  2. **Minimal Branchless Drivers (`infrastructure/drivers/kv/`, `infrastructure/drivers/http/`)**: Raw JSON file KV read/write and raw `fetch` HTTP POST ONLY; zero `if`/`switch`/`match`/ternary branches.
  3. **DI Repository & Gateways (`infrastructure/repositories/order/`, `infrastructure/gateways/{inventory,payment,events}/`)**: Accept driver interfaces via DI and handle missing keys, malformed JSON, version conflicts, timeouts, stock shortages, payment declines, and event publication.
- **Presentation (`presentation/controllers/order/` + `presentation/views/order/`)**: Web UI controller accepting `OrderUseCases` via DI and pure view rendering functions; verified via Mock + Headless Chromium browser flows.

## Unit-Test Exclusions & C1 100% Coverage Governance

- **Target outside exclusions**: **100% C1 (branch) coverage mandatory**.
- **Inline ignore directives**: Zero allowed (`ai-ddd verify` enforces).
- **Authorized Exclusions (`c1-coverage.config.json`)**:
  - `src/infrastructure/drivers/**`: Branchless `FileKvDriver` and `FetchHttpJsonDriver` (verified in integration test).
  - `src/main.ts`: Composition root wiring DI and HTTP startup (verified in integration test).

## Distribution & Integration Test Plan

- **Distribution Mode**: `binary` (standalone Node.js process).
- **Integration Verification**: `scripts/test-integration.sh` starts stub inventory/payment HTTP servers and spawns the real `src/main.ts` process using `FileKvDriver` and `FetchHttpJsonDriver`, exercising create (1..5 lines) -> confirm -> cancel over real HTTP and disk storage, including compensation and version persistence.
