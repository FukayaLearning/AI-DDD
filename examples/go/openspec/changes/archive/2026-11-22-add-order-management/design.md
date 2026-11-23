# Design

## Strategic DDD Alignment

- **Bounded Context**: `ordering`
- **Ubiquitous Language Updates**: Synced to `docs/domain/ubiquitous-language.md`
- **Context Map & External Integration**: Synced to `docs/domain/context-map.md` (cross-repo OpenSpec linking: `T.B.D.`)

## Tactical Domain Model (`internal/domain/`)

- **Value Objects**: `OrderId`, `CustomerId`, `ProductId`, `Money` (`JPY` | `USD`, `Add`, `Multiply`) in `internal/domain/value_objects/shared/`; `Quantity` (1..100) in `internal/domain/value_objects/order/`.
- **Entities & Aggregate Roots**: `OrderLine`, `Order` (`Draft` | `Confirmed` | `Cancelled`) in `internal/domain/entities/order/`.
- **Domain Events**: `OrderConfirmedEvent`, `OrderCancelledEvent` in `internal/domain/entities/order/`.
- **Domain Ports**: `OrderRepository` in `internal/domain/repositories/order/`; `InventoryPort` and `PaymentPort` in `internal/application/ports/{inventory,payment}/`.
- **Error Modeling (`Result[T, DomainError]`)**: Generic value-based `Success` / `Failure`.

## 4-Layer Architecture & Infrastructure 3-Part Separation

- **Dependency Rule**: `presentation -> application -> domain <- infrastructure`; `presentation` never imports `infrastructure`.
- **Infrastructure Split**:
  1. Pure `internal/infrastructure/mappers/order/OrderMapper` transformations.
  2. Branchless `internal/infrastructure/drivers/kv/` and `internal/infrastructure/drivers/http/` (raw I/O only).
  3. `internal/infrastructure/repositories/order/DriverOrderRepository` and `internal/infrastructure/gateways/{inventory,payment}/` unit-tested with mock drivers.

## Unit-Test Exclusions & C1 100% Coverage Governance

- **Target outside exclusions**: **100% coverage outside exclusions (`go test -covermode=atomic` + branch audit)**.
- **Authorized Exclusions**:
  - `internal/infrastructure/drivers/*`: Branchless `FileKvDriver` and `NetHttpJsonDriver`.
  - `cmd/server/main.go`: Composition root.

## Distribution & Integration Test Plan

- **Distribution Mode**: `binary` (`cmd/server`).
- **Integration Verification**: `scripts/test-integration.sh` compiles `cmd/server` and tests real HTTP + disk persistence.
