# Unit Test Specification — application/order

| ID | Design Element | Technique | Input | Expected | Rationale | Automated Test |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `UT-ORD-021` | `placeOrder` | Scenario 1-to-1 | Valid `PlaceOrderCommand` | `Ok(Draft)` with computed total | `SCN-ORD-001-01` | `internal/*/*/*_test.go` |
| `UT-ORD-022` | `placeOrder` | Scenario 1-to-1 | Invalid `orderId`, `customerId`, `productId`, `quantity`, `unitAmount`, or empty lines | Matching `DomainError` without saving | `SCN-ORD-001-02` | `internal/*/*/*_test.go` |
| `UT-ORD-023` | `placeOrder` | Scenario 1-to-1 | Valid command with failing repository | `Err(REPOSITORY_ERROR)` | `SCN-ORD-001-03` | `internal/*/*/*_test.go` |
| `UT-ORD-024` | `getOrder` | Equivalence partitioning | Empty ID, missing ID, existing order ID | `INVALID_ORDER_ID`, `ORDER_NOT_FOUND`, `Ok(dto)` | `REQ-ORD-004` | `internal/*/*/*_test.go` |
| `UT-ORD-025` | `confirmOrder` | Scenario 1-to-1 | Valid, missing/non-draft, insufficient stock, payment declined, save fail | Expected `Ok(Confirmed)` or typed `DomainError` | `SCN-ORD-002-01`, `SCN-ORD-002-02`, `SCN-ORD-002-03` | `internal/*/*/*_test.go` |
| `UT-ORD-026` | `cancelOrder` | Scenario 1-to-1 | Valid, missing, save fail, already cancelled | `Ok(Cancelled)` or typed `DomainError` | `SCN-ORD-003-01`, `SCN-ORD-003-02` | `internal/*/*/*_test.go` |
