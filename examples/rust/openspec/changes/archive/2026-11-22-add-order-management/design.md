# Design

## Strategic DDD Alignment

- **Bounded Context**: `ordering`
- **Ubiquitous Language Updates**: Synced to `docs/domain/ubiquitous-language.md`
- **Context Map & External Integration**: Synced to `docs/domain/context-map.md` (cross-repo OpenSpec linking: `T.B.D.`)

## Tactical Domain Model (`src/domain/`)

- **Value Objects**: `OrderId`, `CustomerId`, `ProductId`, `Money` (`Currency::JPY` | `Currency::USD`) in `src/domain/value_objects/shared/`; `Quantity` (1..100) in `src/domain/value_objects/order/`.
- **Entities & Aggregate Roots**: `OrderLine`, `Order` (`OrderStatus::Draft` | `Confirmed` | `Cancelled`) in `src/domain/entities/order/`.
- **Domain Events**: `DomainEvent::OrderConfirmedEvent`, `DomainEvent::OrderCancelledEvent` in `src/domain/entities/order/`.
- **Domain Ports**: `OrderRepository` in `src/domain/repositories/order/`; `InventoryPort` and `PaymentPort` in `src/application/ports/{inventory,payment}/`.
- **Error Modeling (`DomainResult<T, DomainError>`)**: Explicit value-based errors (`Result`-style enum; zero domain panics).

## 4-Layer Architecture & Infrastructure 3-Part Separation

- **Dependency Rule**: `presentation -> application -> domain <- infrastructure`; `presentation` never references `infrastructure`.
- **Infrastructure Split**:
  1. Pure `src/infrastructure/mappers/order/order_mapper` transformations (`encode_order_record`, `decode_order_record`).
  2. Branchless `src/infrastructure/drivers/{kv,http}/` (no `if`/`else`/`match`).
  3. `src/infrastructure/repositories/order/DriverOrderRepository` and `src/infrastructure/gateways/{inventory,payment}/` unit-tested with mock drivers.

## Unit-Test Exclusions & C1 100% Coverage Governance

- **Target outside exclusions**: **100% coverage outside exclusions (`cargo llvm-cov --branch` when installed, and `cargo test --offline`)**.
- **Authorized Exclusions**:
  - `src/infrastructure/drivers/*`: Branchless `FileKvDriver` and `TcpHttpJsonDriver`.
  - `src/main.rs`: Composition root.

## Distribution & Integration Test Plan

- **Distribution Mode**: `binary` (`target/debug/ordering_rs`).
- **Integration Verification**: `scripts/test-integration.sh` starts stub inventory/payment HTTP servers and runs the compiled binary verifying real disk KV and TCP HTTP drivers.
