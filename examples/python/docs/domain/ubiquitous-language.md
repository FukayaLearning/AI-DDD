# Ubiquitous Language — ordering

> Single Bounded Context repository: **ordering-py** (`ordering`)
> Every term defined here MUST match identifiers in OpenSpec specs, domain code, and tests.

| Term (English Identifier) | Domain Meaning | Layer / Pattern | Notes |
| :--- | :--- | :--- | :--- |
| `Result[T, E]` (`Ok`/`Err`) | Explicit success (`Ok`) or typed failure (`Err`) | Domain Base | No domain exceptions |
| `Order` | Aggregate root representing a customer order | Aggregate Root | States: `Draft`, `Confirmed`, `Cancelled` |
| `OrderLine` | Single product line in an order | Entity | Holds `ProductId`, `Quantity`, unit `Money` |
| `OrderId`, `CustomerId`, `ProductId` | Non-empty trimmed identifiers | Value Objects | Validated via factory functions |
| `Money` | Integer minor-unit amount + `Currency` (`JPY`/`USD`) | Value Object | Non-negative; operations enforce same currency |
| `Quantity` | Item count constrained to `1..100` | Value Object | Validated integer |
| `OrderConfirmedEvent`, `OrderCancelledEvent` | Domain events emitted on transitions | Domain Event | Attached to `Order.events` |
| `OrderRepository`, `InventoryPort`, `PaymentPort` | Persistence and ACL interfaces | Domain Ports | Implemented in `infrastructure` |
