# Design

## Strategic DDD Alignment

- **Bounded Context**: `ordering`
- **Ubiquitous Language Updates**: Synced to `docs/domain/ubiquitous-language.md`
- **Context Map & External Integration**: Synced to `docs/domain/context-map.md` (cross-repo OpenSpec linking: `T.B.D.`)

## Tactical Domain Model (`domain/`)

- **Value Objects**: `OrderId`, `CustomerId`, `ProductId`, `Money` (`JPY` | `USD`, `add`, `multiply`) in `domain/value_objects/shared/`; `Quantity` (1..100) in `domain/value_objects/order/`.
- **Entities & Aggregate Roots**: `OrderLine` entity and `Order` aggregate root (`Draft` | `Confirmed` | `Cancelled`) in `domain/entities/order/`. Invariants: 1..5 lines, no duplicate `ProductId`, single currency across lines, `confirm()` only from `Draft`, `cancel()` forbidden from `Cancelled`.
- **Domain Events**: `OrderConfirmedEvent`, `OrderCancelledEvent`.
- **Domain Ports**: `OrderRepository` in `domain/repositories/order/`; `InventoryPort` and `PaymentPort` in `application/ports/{inventory,payment}/`.
- **Error Modeling (`Result<T, E>`)**: Exhaustive `DomainError` codes (`INVALID_ORDER_ID`, `INVALID_CUSTOMER_ID`, `INVALID_PRODUCT_ID`, `INVALID_MONEY_AMOUNT`, `CURRENCY_MISMATCH`, `INVALID_QUANTITY`, `EMPTY_ORDER_LINES`, `TOO_MANY_ORDER_LINES`, `DUPLICATE_PRODUCT`, `INVALID_ORDER_STATE`, `INSUFFICIENT_STOCK`, `PAYMENT_DECLINED`, `EXTERNAL_TIMEOUT`, `REPOSITORY_ERROR`, `ORDER_NOT_FOUND`).

## 4-Layer Architecture & Infrastructure 3-Part Separation

- **Dependency Rule**: `presentation -> application -> domain <- infrastructure`; `presentation` never imports `infrastructure`; `main.ts` wires DI.
- **Infrastructure Split**:
  1. **Pure Mapper (`infrastructure/mappers/order/order_mapper.ts`)**: `toRecord` / `fromRecord` pure transformations tested without mocks.
  2. **Minimal Branchless Drivers (`infrastructure/drivers/kv/`, `infrastructure/drivers/http/`)**: Raw JSON file KV read/write and raw `fetch` HTTP POST ONLY; zero `if`/`switch`/`match`/ternary branches.
  3. **DI Repository & Gateways (`infrastructure/repositories/order/`, `infrastructure/gateways/{inventory,payment}/`)**: Accept driver interfaces via DI and handle missing keys, malformed JSON, timeouts, stock shortages, and payment declines via `Result<T, E>`.
- **Presentation (`presentation/controllers/order/` + `presentation/views/order/`)**: SSR HTML controller accepting `OrderUseCases` via DI and pure view rendering functions; verified via Mock + Headless Chromium browser flows.

## Unit-Test Exclusions & C1 100% Coverage Governance

- **Target outside exclusions**: **100% C1 (branch) coverage mandatory**.
- **Inline ignore directives**: Zero allowed (`ai-ddd verify` enforces).
- **Authorized Exclusions (`c1-coverage.config.json`)**:
  - `src/infrastructure/drivers/**`: Branchless `FileKvDriver` and `FetchHttpJsonDriver` (verified in integration test).
  - `src/main.ts`: Composition root wiring DI and HTTP startup (verified in integration test).

## Distribution & Integration Test Plan

- **Distribution Mode**: `binary` (standalone Node.js process).
- **Integration Verification**: `scripts/test-integration.sh` starts stub inventory/payment HTTP servers and spawns the real `src/main.ts` process using `FileKvDriver` and `FetchHttpJsonDriver`, exercising create -> confirm -> cancel over real HTTP and disk storage.
