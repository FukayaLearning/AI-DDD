<!-- ai-ddd-translation: source=order.md sha256=4335463a1b4dc050ef9097b9e381d3a718059d9363651828c3bb1a27857aaf85 locale=ja -->

# Unit Test Specification — domain/order

| ID | Design Element | Technique | Input | Expected | Rationale | Automated Test |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `UT-ORD-001` | `OrderId` | Equivalence partitioning | Whitespace string / trimmed string | `Err(INVALID_ORDER_ID)` / `Ok` | `REQ-ORD-001` | `internal/*/*/*_test.go` |
| `UT-ORD-002` | `CustomerId` | Equivalence partitioning | Empty string / trimmed string | `Err(INVALID_CUSTOMER_ID)` / `Ok` | `REQ-ORD-001` | `internal/*/*/*_test.go` |
| `UT-ORD-003` | `ProductId` | Equivalence partitioning | Empty string / trimmed string | `Err(INVALID_PRODUCT_ID)` / `Ok` | `REQ-ORD-001` | `internal/*/*/*_test.go` |
| `UT-ORD-004` | `Quantity` | Boundary value analysis | `0`, `1`, `100`, `101`, `1.5` | `Ok` for `1..100` integer, `Err(INVALID_QUANTITY)` otherwise | `REQ-ORD-001` | `internal/*/*/*_test.go` |
| `UT-ORD-005` | `Money` | Boundary value analysis | `-1`, `10.5`, `0 JPY`, `500 JPY`, `5 USD` | `Err(INVALID_MONEY_AMOUNT)` for negative/decimal, `Ok` otherwise | `REQ-ORD-001` | `internal/*/*/*_test.go` |
| `UT-ORD-006` | `Money` operations | Equivalence partitioning | `multiplyMoney`, `addMoney` same & different currency | Correct product/sum or `Err(CURRENCY_MISMATCH)` | `REQ-ORD-001` | `internal/*/*/*_test.go` |
| `UT-ORD-007` | `Order.create` (lines=0) | Boundary value analysis | Empty line array `[]` | `Err(EMPTY_ORDER_LINES)` | `SCN-ORD-001-02` | `internal/*/*/*_test.go` |
| `UT-ORD-008` | `Order.create` (lines=6) | Boundary value analysis | 6 unique order lines | `Err(TOO_MANY_ORDER_LINES)` | `SCN-ORD-001-02` | `internal/*/*/*_test.go` |
| `UT-ORD-009` | `Order.create` (duplicate) | Error guessing | Two lines with identical `ProductId` | `Err(DUPLICATE_PRODUCT)` | `SCN-ORD-001-02` | `internal/*/*/*_test.go` |
| `UT-ORD-010` | `Order.create` (currency) | Error guessing | Lines mixing `JPY` and `USD` | `Err(CURRENCY_MISMATCH)` | `SCN-ORD-001-02` | `internal/*/*/*_test.go` |
| `UT-ORD-011` | `Order.create` (valid) | Equivalence partitioning | 1..5 valid lines | `Ok(Draft)` and accurate `totalAmount()` | `SCN-ORD-001-01` | `internal/*/*/*_test.go` |
| `UT-ORD-012` | `Order.confirm` | State transition | `Draft` -> `Confirmed` -> `confirm()` | `Confirmed` + `OrderConfirmedEvent`, second confirm returns `INVALID_ORDER_STATE` | `REQ-ORD-002` | `internal/*/*/*_test.go` |
| `UT-ORD-013` | `Order.cancel` | State transition | `Confirmed` -> `Cancelled` -> `cancel()` | `Cancelled` + `OrderCancelledEvent`, second cancel returns `INVALID_ORDER_STATE` | `REQ-ORD-003` | `internal/*/*/*_test.go` |
