# Ubiquitous Language — ordering

> Single Bounded Context repository: **ordering_rs** (`ordering`)
> Every term defined here MUST match identifiers in OpenSpec specs, domain code, and tests.

| Term (English Identifier) | Domain Meaning | Layer / Pattern | Notes |
| :--- | :--- | :--- | :--- |
| `DomainResult<T, E>` (`Ok`/`Err`) | Explicit success or typed failure value | Domain Base | No panics for business/IO failures |
| `Order` | Aggregate root representing a customer order | Aggregate Root | States: `Draft`, `Confirmed`, `Cancelled` |
| `OrderLine` | Single product line in an order | Entity | Holds `ProductId`, `Quantity`, unit `Money` |
| `OrderId`, `CustomerId`, `ProductId` | Non-empty trimmed identifiers | Value Objects | Validated constructors |
| `Money` | Integer minor-unit amount + `Currency` (`JPY`/`USD`) | Value Object | Non-negative; same currency checks |
| `Quantity` | Item count constrained to `1..100` | Value Object | Validated `u32` |
| `OrderConfirmedEvent`, `OrderCancelledEvent` | Domain events emitted on transitions | Domain Event | Stored on `Order.events` |
| `OrderRepository`, `InventoryPort`, `PaymentPort` | Persistence and ACL traits | Domain Ports | Implemented in `infrastructure` |
