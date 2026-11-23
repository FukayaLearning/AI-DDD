# Design

## Strategic DDD Alignment

- **Bounded Context**: `ordering`
- **Ubiquitous Language Updates**: Synced to `docs/domain/ubiquitous-language.md`
- **Context Map & External Integration**: Synced to `docs/domain/context-map.md` (cross-repo OpenSpec linking: `T.B.D.`)

## Tactical Domain Model (`src/domain/`)

- **Value Objects**: `OrderId`, `CustomerId`, `ProductId`, `Money` (`JPY` | `USD`, `add`, `multiply`) in `src/domain/value_objects/shared/`; `Quantity` (1..100) in `src/domain/value_objects/order/`.
- **Entities & Aggregate Roots**: `OrderLine`, `Order` (`Draft` | `Confirmed` | `Cancelled`) in `src/domain/entities/order/`.
- **Domain Events**: `OrderConfirmedEvent`, `OrderCancelledEvent` in `src/domain/entities/order/`.
- **Domain Ports**: `OrderRepository` in `src/domain/repositories/order/`; `InventoryPort` and `PaymentPort` in `src/application/ports/{inventory,payment}/`.
- **Error Modeling (`Result[T, E]`)**: Frozen `Ok[T]` / `Err[DomainError]` dataclasses.

## 4-Layer Architecture & Infrastructure 3-Part Separation

- **Dependency Rule**: `presentation -> application -> domain <- infrastructure`; `presentation` never imports `infrastructure`.
- **Infrastructure Split**:
  1. Pure `src/infrastructure/mappers/order/order_mapper.py` transformations.
  2. Branchless `src/infrastructure/drivers/kv/` and `src/infrastructure/drivers/http/` (raw I/O only).
  3. `src/infrastructure/repositories/order/DriverOrderRepository` and `src/infrastructure/gateways/{inventory,payment}/` tested to 100% C1 with mock drivers.

## Unit-Test Exclusions & C1 100% Coverage Governance

- **Target outside exclusions**: **100% C1 (branch) coverage mandatory**.
- **Authorized Exclusions (`pyproject.toml` & `scripts/run_c1_coverage.py`)**:
  - `src/infrastructure/drivers/*`: Branchless `FileKvDriver` and `UrllibHttpJsonDriver` (verified in integration test).
  - `src/main.py`: Composition root (verified in integration test).

## Distribution & Integration Test Plan

- **Distribution Mode**: `binary` (standalone Python process).
- **Integration Verification**: `scripts/test-integration.sh` starts stub HTTP services and launches `python3 -m src.main` with real `FileKvDriver` and `UrllibHttpJsonDriver`.
