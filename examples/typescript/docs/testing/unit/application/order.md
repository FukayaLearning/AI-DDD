# Unit Test Specification — application/services/order, application/dtos/order, application/ports/{inventory,payment,events}

| ID | Design Element | Technique | Input | Expected | Rationale | Automated Test |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `UT-ORD-021` | `placeOrder` | Scenario 1-to-1 | Valid `PlaceOrderCommand` | `Ok(Draft)` with computed total and no events | `SCN-ORD-001-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-022` | `placeOrder` | Scenario 1-to-1 | Invalid `orderId`, `customerId`, `productId`, `quantity`, `unitAmount`, or empty lines | Matching `DomainError` without saving | `SCN-ORD-001-02` | `tests/unit/application.test.mjs` |
| `UT-ORD-023` | `placeOrder` | Scenario 1-to-1 | Valid command with failing repository | `Err(REPOSITORY_ERROR)` | `SCN-ORD-001-03` | `tests/unit/application.test.mjs` |
| `UT-ORD-024` | `getOrder` | Equivalence partitioning | Empty ID, missing ID, existing order, overflow total | `INVALID_ORDER_ID`, `ORDER_NOT_FOUND`, `Ok(dto)`, `INVALID_MONEY_AMOUNT` | `SCN-ORD-004-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-025` | `confirmOrder` | Scenario 1-to-1 | Valid Draft order | `Ok(Confirmed)` and one published event | `SCN-ORD-002-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-026` | `confirmOrder` | Scenario 1-to-1 | Missing ID, missing order, already confirmed order | `INVALID_ORDER_ID`, `ORDER_NOT_FOUND`, `INVALID_ORDER_STATE` | `SCN-ORD-002-02` | `tests/unit/application.test.mjs` |
| `UT-ORD-040` | `confirmOrder` compensation | Scenario 1-to-1 | Payment declined after inventory reservation | `Err(PAYMENT_DECLINED)` and inventory released; order remains `Draft` | `SCN-ORD-002-03` | `tests/unit/application.test.mjs` |
| `UT-ORD-041` | `confirmOrder` compensation | Scenario 1-to-1 | Save fails after successful payment | `Err(REPOSITORY_ERROR)` and payment refunded | `SCN-ORD-002-03` | `tests/unit/application.test.mjs` |
| `UT-ORD-042` | `confirmOrder` event publication | Scenario 1-to-1 | Publisher fails | `Err(EVENT_PUBLISH_FAILED)` | `SCN-ORD-002-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-043` | `cancelOrder` | Scenario 1-to-1 | Draft and Confirmed orders | `Ok(Cancelled)`; Confirmed cancellation releases stock and refunds payment | `SCN-ORD-003-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-044` | `cancelOrder` | Scenario 1-to-1 | Missing ID, missing order, already cancelled order | `INVALID_ORDER_ID`, `ORDER_NOT_FOUND`, `INVALID_ORDER_STATE` | `SCN-ORD-003-02` | `tests/unit/application.test.mjs` |
| `UT-ORD-045` | `cancelOrder` compensation | Scenario 1-to-1 | Inventory release or payment refund fails | `Err(EXTERNAL_TIMEOUT)` | `SCN-ORD-003-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-046` | `confirmOrder` compensation | Scenario 1-to-1 | Inventory release fails after payment failure | `Err(EXTERNAL_TIMEOUT)` | `SCN-ORD-002-03` | `tests/unit/application.test.mjs` |
| `UT-ORD-047` | `placeOrder` event publication | Scenario 1-to-1 | Publisher fails | `Err(EVENT_PUBLISH_FAILED)` | `SCN-ORD-001-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-048` | `confirmOrder` compensation | Scenario 1-to-1 | Payment refund fails after save failure | `Err(EXTERNAL_TIMEOUT)` | `SCN-ORD-002-03` | `tests/unit/application.test.mjs` |
| `UT-ORD-049` | `cancelOrder` persistence | Scenario 1-to-1 | Save fails | `Err(REPOSITORY_ERROR)` | `SCN-ORD-003-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-050` | `cancelOrder` event publication | Scenario 1-to-1 | Publisher fails | `Err(EVENT_PUBLISH_FAILED)` | `SCN-ORD-003-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-055` | `confirmOrder` stock failure | Scenario 1-to-1 | Inventory reservation fails | `Err(INSUFFICIENT_STOCK)` | `SCN-ORD-002-03` | `tests/unit/application.test.mjs` |
| `UT-ORD-056` | `cancelOrder` overflow | Scenario 1-to-1 | Confirmed order whose total overflows | `Err(INVALID_MONEY_AMOUNT)` | `SCN-ORD-003-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-057` | `getOrder` read failure | Scenario 1-to-1 | Repository read fails | `Err(REPOSITORY_ERROR)` | `SCN-ORD-004-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-058` | `confirmOrder` read failure | Scenario 1-to-1 | Repository read fails | `Err(REPOSITORY_ERROR)` | `SCN-ORD-002-03` | `tests/unit/application.test.mjs` |
| `UT-ORD-059` | `cancelOrder` read failure | Scenario 1-to-1 | Repository read fails | `Err(REPOSITORY_ERROR)` | `SCN-ORD-003-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-060` | DTO module | Module load | Import DTO module | Module loads at runtime | `SCN-ORD-004-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-064` | `confirmOrder` overflow | Scenario 1-to-1 | Order whose total overflows | `Err(INVALID_MONEY_AMOUNT)` | `SCN-ORD-002-03` | `tests/unit/application.test.mjs` |
