# Design

## Strategic DDD Alignment

- **Bounded Context**: `ordering`
- **Ubiquitous Language Updates**: Synced to `docs/domain/ubiquitous-language.md`
- **Context Map & External Integration**: Synced to `docs/domain/context-map.md` (cross-repo OpenSpec linking: `T.B.D.`)

## Tactical Domain Model (`src/domain/`)

- **Value Objects**: `OrderId`, `CustomerId`, `ProductId`, `Money` (`JPY` | `USD`, `add`, `multiply`), `Quantity` (1..100).
- **Entities & Aggregate Roots**: `OrderLine`, `Order` (`Draft` | `Confirmed` | `Cancelled`).
- **Domain Events**: `OrderConfirmedEvent`, `OrderCancelledEvent`.
- **Domain Ports**: `OrderRepository`, `InventoryPort`, `PaymentPort`.
- **Error Modeling (`Result[T, E]`)**: Frozen `Ok[T]` / `Err[DomainError]` dataclasses.

## 4-Layer Architecture & Infrastructure 3-Part Separation

- **Dependency Rule**: `presentation -> application -> domain <- infrastructure`; `presentation` never imports `infrastructure`.
- **Infrastructure Split**:
  1. Pure `order_mapper.py` transformations.
  2. Branchless `src/infrastructure/drivers/kv_driver.py` and `http_driver.py` (raw I/O only).
  3. `DriverOrderRepository`, `InventoryGateway`, `PaymentGateway` tested to 100% C1 with mock drivers.

## Unit-Test Exclusions & C1 100% Coverage Governance

- **Target outside exclusions**: **100% C1 (branch) coverage mandatory**.
- **Authorized Exclusions (`pyproject.toml` & `scripts/run_c1_coverage.py`)**:
  - `src/infrastructure/drivers/*`: Branchless `FileKvDriver` and `UrllibHttpJsonDriver` (verified in integration test).
  - `src/main.py`: Composition root (verified in integration test).

## Distribution & Integration Test Plan

- **Distribution Mode**: `binary` (standalone Python process).
- **Integration Verification**: `scripts/test-integration.sh` starts stub HTTP services and launches `python3 -m src.main` with real `FileKvDriver` and `UrllibHttpJsonDriver`.
