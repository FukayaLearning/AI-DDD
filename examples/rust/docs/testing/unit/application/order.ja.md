<!-- ai-ddd-translation: source=order.md sha256=716d4383b73d8e8ef9b02c268e3095741e8300153d14212703cd30ed3af61f73 locale=ja -->

# Unit Test Specification — application/order

| ID | Design Element | Technique | Input | Expected | Rationale | Automated Test |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `UT-ORD-021` | `placeOrder` | Scenario 1-to-1 | Valid `PlaceOrderCommand` | `Ok(Draft)` with computed total | `SCN-ORD-001-01` | `tests/ordering_test.rs` |
| `UT-ORD-022` | `placeOrder` | Scenario 1-to-1 | Invalid `orderId`, `customerId`, `productId`, `quantity`, `unitAmount`, or empty lines | Matching `DomainError` without saving | `SCN-ORD-001-02` | `tests/ordering_test.rs` |
| `UT-ORD-023` | `placeOrder` | Scenario 1-to-1 | Valid command with failing repository | `Err(REPOSITORY_ERROR)` | `SCN-ORD-001-03` | `tests/ordering_test.rs` |
| `UT-ORD-024` | `getOrder` | Equivalence partitioning | Empty ID, missing ID, existing order ID | `INVALID_ORDER_ID`, `ORDER_NOT_FOUND`, `Ok(dto)` | `REQ-ORD-004` | `tests/ordering_test.rs` |
| `UT-ORD-025` | `confirmOrder` | Scenario 1-to-1 | Valid, missing/non-draft, insufficient stock, payment declined, save fail | Expected `Ok(Confirmed)` or typed `DomainError` | `SCN-ORD-002-01`, `SCN-ORD-002-02`, `SCN-ORD-002-03` | `tests/ordering_test.rs` |
| `UT-ORD-026` | `cancelOrder` | Scenario 1-to-1 | Valid, missing, save fail, already cancelled | `Ok(Cancelled)` or typed `DomainError` | `SCN-ORD-003-01`, `SCN-ORD-003-02` | `tests/ordering_test.rs` |
