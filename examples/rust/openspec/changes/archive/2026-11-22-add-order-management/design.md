# Design

## Strategic DDD Alignment

- **Bounded Context**: `ordering`
- **Ubiquitous Language Updates**: Synced to `docs/domain/ubiquitous-language.md`
- **Context Map & External Integration**: Synced to `docs/domain/context-map.md` (cross-repo OpenSpec linking: `T.B.D.`)

## Tactical Domain Model (`src/domain/`)

- **Value Objects**: `OrderId`, `CustomerId`, `ProductId`, `Money` (`Currency::JPY` | `Currency::USD`), `Quantity` (1..100).
- **Entities & Aggregate Roots**: `OrderLine`, `Order` (`OrderStatus::Draft` | `Confirmed` | `Cancelled`).
- **Domain Events**: `DomainEvent::OrderConfirmedEvent`, `DomainEvent::OrderCancelledEvent`.
- **Domain Ports**: `OrderRepository`, `InventoryPort`, `PaymentPort`.
- **Error Modeling (`DomainResult<T, DomainError>`)**: Explicit value-based errors (`Result`-style enum; zero domain panics).

## 4-Layer Architecture & Infrastructure 3-Part Separation

- **Dependency Rule**: `presentation -> application -> domain <- infrastructure`; `presentation` never references `infrastructure`.
- **Infrastructure Split**:
  1. Pure `order_mapper` transformations (`to_record`, `from_record`).
  2. Branchless `src/infrastructure/drivers/{kv_driver.rs,http_driver.rs}` (no `if`/`else`/`match`).
  3. `DriverOrderRepository`, `InventoryGateway`, `PaymentGateway` unit-tested with mock drivers.

## Unit-Test Exclusions & C1 100% Coverage Governance

- **Target outside exclusions**: **100% coverage outside exclusions (`cargo llvm-cov --branch` when installed, and `cargo test --offline`)**.
- **Authorized Exclusions**:
  - `src/infrastructure/drivers/*`: Branchless `FileKvDriver` and `TcpHttpJsonDriver`.
  - `src/main.rs`: Composition root.

## Distribution & Integration Test Plan

- **Distribution Mode**: `binary` (`target/debug/ordering_rs`).
- **Integration Verification**: `scripts/test-integration.sh` starts stub inventory/payment HTTP servers and runs the compiled binary verifying real disk KV and TCP HTTP drivers.
