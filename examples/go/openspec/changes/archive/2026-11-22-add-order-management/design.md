# Design

## Strategic DDD Alignment

- **Bounded Context**: `ordering`
- **Ubiquitous Language Updates**: Synced to `docs/domain/ubiquitous-language.md`
- **Context Map & External Integration**: Synced to `docs/domain/context-map.md` (cross-repo OpenSpec linking: `T.B.D.`)

## Tactical Domain Model (`internal/domain/`)

- **Value Objects**: `OrderId`, `CustomerId`, `ProductId`, `Money` (`JPY` | `USD`, `Add`, `Multiply`), `Quantity` (1..100).
- **Entities & Aggregate Roots**: `OrderLine`, `Order` (`Draft` | `Confirmed` | `Cancelled`).
- **Domain Events**: `OrderConfirmedEvent`, `OrderCancelledEvent`.
- **Domain Ports**: `OrderRepository`, `InventoryPort`, `PaymentPort`.
- **Error Modeling (`Result[T, DomainError]`)**: Generic value-based `Success` / `Failure`.

## 4-Layer Architecture & Infrastructure 3-Part Separation

- **Dependency Rule**: `presentation -> application -> domain <- infrastructure`; `presentation` never imports `infrastructure`.
- **Infrastructure Split**:
  1. Pure `OrderMapper` transformations.
  2. Branchless `internal/infrastructure/drivers/kv_driver.go` and `http_driver.go` (raw I/O only).
  3. `DriverOrderRepository`, `InventoryGateway`, `PaymentGateway` unit-tested with mock drivers.

## Unit-Test Exclusions & C1 100% Coverage Governance

- **Target outside exclusions**: **100% coverage outside exclusions (`go test -covermode=atomic` + branch audit)**.
- **Authorized Exclusions**:
  - `internal/infrastructure/drivers/*`: Branchless `FileKvDriver` and `NetHttpJsonDriver`.
  - `cmd/server/main.go`: Composition root.

## Distribution & Integration Test Plan

- **Distribution Mode**: `binary` (`cmd/server`).
- **Integration Verification**: `scripts/test-integration.sh` compiles `cmd/server` and tests real HTTP + disk persistence.
