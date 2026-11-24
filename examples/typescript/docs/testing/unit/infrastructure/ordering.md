# Unit Test Specification — infrastructure/mappers/order, infrastructure/repositories/order, infrastructure/gateways/{inventory,payment,events}

| ID | Design Element | Technique | Input | Expected | Rationale | Automated Test |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `UT-ORD-014` | `order_mapper` | Equivalence partitioning | Valid record, legacy record without version, invalid fields/version/status | `Ok(Order)` or `Err(REPOSITORY_ERROR)`; no events persisted | `SCN-ORD-001-02` | `tests/unit/infrastructure.test.mjs` |
| `UT-ORD-015` | `DriverOrderRepository` | Mock driver normal & not-found | In-memory mock KV driver (`save`, `findById`, missing key `ENOENT`) | `Ok` / `Err(ORDER_NOT_FOUND)`; version increments | `SCN-ORD-001-01` | `tests/unit/infrastructure.test.mjs` |
| `UT-ORD-016` | `DriverOrderRepository` | Mock driver failure | Driver throwing I/O error or returning corrupted JSON | `Err(REPOSITORY_ERROR)` | `SCN-ORD-001-03` | `tests/unit/infrastructure.test.mjs` |
| `UT-ORD-017` | `InventoryGateway` reserve | Mock HTTP response | HTTP 200 / HTTP 409 | `Ok` / `Err(INSUFFICIENT_STOCK)` | `SCN-ORD-002-03` | `tests/unit/infrastructure.test.mjs` |
| `UT-ORD-018` | `InventoryGateway` reserve | Mock HTTP failure | HTTP 500 / network timeout | `Err(EXTERNAL_TIMEOUT)` | `SCN-ORD-002-03` | `tests/unit/infrastructure.test.mjs` |
| `UT-ORD-019` | `PaymentGateway` charge | Mock HTTP response | HTTP 200 / HTTP 402 | `Ok` / `Err(PAYMENT_DECLINED)` | `SCN-ORD-002-03` | `tests/unit/infrastructure.test.mjs` |
| `UT-ORD-020` | `PaymentGateway` charge | Mock HTTP failure | HTTP 503 / network timeout | `Err(EXTERNAL_TIMEOUT)` | `SCN-ORD-002-03` | `tests/unit/infrastructure.test.mjs` |
| `UT-ORD-061` | `InventoryGateway` release | Mock HTTP response | HTTP 200 / HTTP 500 / timeout | `Ok` / `Err(EXTERNAL_TIMEOUT)` | `SCN-ORD-002-03` | `tests/unit/infrastructure.test.mjs` |
| `UT-ORD-062` | `PaymentGateway` refund | Mock HTTP response | HTTP 200 / HTTP 500 / timeout | `Ok` / `Err(EXTERNAL_TIMEOUT)` | `SCN-ORD-002-03` | `tests/unit/infrastructure.test.mjs` |
| `UT-ORD-065` | `LoggingEventPublisher` | Equivalence partitioning | Pulled events and empty list | Events logged; `Ok` | `SCN-ORD-002-01` | `tests/unit/infrastructure.test.mjs` |
| `UT-ORD-066` | `DriverOrderRepository` | State transition | Save with stale version | `Err(CONFLICT)` | `SCN-ORD-002-03` | `tests/unit/infrastructure.test.mjs` |
| `UT-ORD-067` | `DriverOrderRepository` | Equivalence partitioning | Legacy record without `version` | Treated as version 0; save increments to 1 | `SCN-ORD-001-01` | `tests/unit/infrastructure.test.mjs` |
| `UT-ORD-068` | `DriverOrderRepository` | Fault injection | New-key lookup then `put` failure | `Err(REPOSITORY_ERROR)` | `SCN-ORD-001-03` | `tests/unit/infrastructure.test.mjs` |
