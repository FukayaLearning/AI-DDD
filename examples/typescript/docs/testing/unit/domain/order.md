# Unit Test Specification — domain/entities/order, domain/value_objects/shared, domain/value_objects/order

| ID | Design Element | Technique | Input | Expected | Rationale | Automated Test |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `UT-ORD-001` | `OrderId` | Equivalence partitioning | Whitespace string / trimmed string | `Err(INVALID_ORDER_ID)` / `Ok` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-002` | `CustomerId` | Equivalence partitioning | Empty string / trimmed string | `Err(INVALID_CUSTOMER_ID)` / `Ok` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-003` | `ProductId` | Equivalence partitioning | Empty string / trimmed string | `Err(INVALID_PRODUCT_ID)` / `Ok` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-004` | `Quantity` | Boundary value analysis | `0`, `1`, `100`, `101`, `1.5` | `Ok` for `1..100` integer, `Err(INVALID_QUANTITY)` otherwise | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-005` | `Money` | Boundary value analysis | `-1`, `10.5`, `0 JPY`, `500 JPY`, `5 USD`, `5 EUR` | `Err` for negative/decimal/unsupported currency, `Ok` otherwise | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-006` | `Money` operations | Equivalence partitioning | `multiplyMoney`, `addMoney` same & different currency | Correct product/sum or `Err(CURRENCY_MISMATCH)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-007` | `Order.create` (lines=0) | Boundary value analysis | Empty line array `[]` | `Err(EMPTY_ORDER_LINES)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-008` | `Order.create` (lines=6) | Boundary value analysis | 6 unique order lines | `Err(TOO_MANY_ORDER_LINES)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-009` | `Order.create` (duplicate) | Error guessing | Two lines with identical `ProductId` | `Err(DUPLICATE_PRODUCT)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-010` | `Order.create` (currency) | Error guessing | Lines mixing `JPY` and `USD` | `Err(CURRENCY_MISMATCH)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-011` | `Order.create` (valid) | Equivalence partitioning | 1..5 valid lines | `Ok(Draft)` and accurate `totalAmount()` | `SCN-ORD-001-01` | `tests/unit/domain.test.mjs` |
| `UT-ORD-012` | `Order.confirm` | State transition | `Draft` -> `Confirmed` -> `confirm()` | `Confirmed` + `OrderConfirmedEvent`, second confirm returns `INVALID_ORDER_STATE` | `SCN-ORD-002-01` | `tests/unit/domain.test.mjs` |
| `UT-ORD-013` | `Order.cancel` | State transition | `Confirmed` -> `Cancelled` -> `cancel()` | `Cancelled` + `OrderCancelledEvent`, second cancel returns `INVALID_ORDER_STATE` | `SCN-ORD-003-01` | `tests/unit/domain.test.mjs` |
| `UT-ORD-032` | Value-object construction | Error guessing | Direct invalid construction of IDs, `Quantity`, `Money` | Constructor throws before an invalid value can circulate | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-033` | Factory separation | Equivalence partitioning | `Order.create` vs `Order.reconstitute`; invalid version/status | New orders are always `Draft`/version 0; reconstitution validates invariants | `SCN-ORD-001-01` | `tests/unit/domain.test.mjs` |
| `UT-ORD-034` | Entity identity equality | Equivalence partitioning | Same `OrderId` with different state / different `OrderId` | Equality by `OrderId` only | `SCN-ORD-001-01` | `tests/unit/domain.test.mjs` |
| `UT-ORD-035` | Event lifecycle | State transition | `pullEvents()` twice and `clearEvents()` | Events are pulled once and cleared | `SCN-ORD-002-01` | `tests/unit/domain.test.mjs` |
| `UT-ORD-036` | Transition predicates | State transition | `canConfirm()` / `canCancel()` across states | Correct predicate values | `SCN-ORD-002-01` | `tests/unit/domain.test.mjs` |
| `UT-ORD-037` | Forged `OrderLine` | Error guessing | Object literals instead of value objects | `Err(INVALID_PRODUCT_ID)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-038` | Money overflow | Boundary value analysis | `MAX_SAFE_INTEGER` addition/multiplication | `Err(INVALID_MONEY_AMOUNT)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-039` | Forged Quantity/Money | Error guessing | Object literals for `Quantity` and `Money` | `Err(INVALID_QUANTITY)` / `Err(INVALID_MONEY_AMOUNT)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-052` | `totalAmount` overflow | Boundary value analysis | Two lines whose sum overflows | `Err(INVALID_MONEY_AMOUNT)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-053` | Value-object equality | Equivalence partitioning | Equal and unequal value objects | Attribute equality | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-054` | `createMoney` factory | Equivalence partitioning | Valid and negative amount | `Ok` / `Err(INVALID_MONEY_AMOUNT)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-063` | Confirm with overflow total | Boundary value analysis | Confirming an order whose total overflows | `Err(INVALID_MONEY_AMOUNT)` | `SCN-ORD-002-01` | `tests/unit/domain.test.mjs` |
