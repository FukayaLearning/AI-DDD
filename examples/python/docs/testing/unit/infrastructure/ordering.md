# Unit Test Specification — infrastructure

| ID | Design Element | Technique | Input | Expected | Rationale | Automated Test |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `UT-ORD-014` | `order_mapper` | Equivalence partitioning | Valid record and invalid `id`/`customerId`/`productId`/`quantity`/`unitAmount`/`lines` | `Ok(Order)` or `Err(REPOSITORY_ERROR)` | `REQ-ORD-001` | `tests/unit/test_ordering.py` |
| `UT-ORD-015` | `DriverOrderRepository` | Mock driver normal & not-found | In-memory mock KV driver (`save`, `findById`, missing key `ENOENT`) | `Ok` / `Err(ORDER_NOT_FOUND)` | `REQ-ORD-001` | `tests/unit/test_ordering.py` |
| `UT-ORD-016` | `DriverOrderRepository` | Mock driver failure | Driver throwing I/O error or returning corrupted JSON | `Err(REPOSITORY_ERROR)` | `SCN-ORD-001-03` | `tests/unit/test_ordering.py` |
| `UT-ORD-017` | `InventoryGateway` | Mock HTTP response | HTTP 200 / HTTP 409 | `Ok` / `Err(INSUFFICIENT_STOCK)` | `SCN-ORD-002-03` | `tests/unit/test_ordering.py` |
| `UT-ORD-018` | `InventoryGateway` | Mock HTTP failure | HTTP 500 / network timeout | `Err(EXTERNAL_TIMEOUT)` | `SCN-ORD-002-03` | `tests/unit/test_ordering.py` |
| `UT-ORD-019` | `PaymentGateway` | Mock HTTP response | HTTP 200 / HTTP 402 | `Ok` / `Err(PAYMENT_DECLINED)` | `SCN-ORD-002-03` | `tests/unit/test_ordering.py` |
| `UT-ORD-020` | `PaymentGateway` | Mock HTTP failure | HTTP 503 / network timeout | `Err(EXTERNAL_TIMEOUT)` | `SCN-ORD-002-03` | `tests/unit/test_ordering.py` |
