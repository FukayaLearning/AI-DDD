# Ubiquitous Language — ordering

> Single Bounded Context repository: **ordering-rs** (`ordering`, `ORD`)
> Every term defined here MUST match identifiers in OpenSpec specs, domain code, and tests.

| Term (English Identifier) | Domain Meaning | Layer / Pattern | Notes |
| :--- | :--- | :--- | :--- |
| `Result<T, E>` | Explicit success (`Ok`) or typed failure (`Err`) | Domain Shared | All expected errors are values |
| `Order` | Aggregate root representing a customer order | Domain Order Aggregate | States: `Draft`, `Confirmed`, `Cancelled` |
| `OrderLine` | Single product line in an order | Domain Order Entity | Holds `ProductId`, `Quantity`, unit `Money` |
| `OrderId` | Unique identifier for an `Order` | Domain Shared VO | Non-empty trimmed string |
| `CustomerId` | Identifier of the ordering customer | Domain Shared VO | Non-empty trimmed string |
| `ProductId` | Identifier of an ordered product | Domain Shared VO | Unique per `Order` |
| `Money` | Integer minor-unit monetary value + `Currency` (`JPY` / `USD`) | Domain Shared VO | Non-negative; operations enforce same currency |
| `Quantity` | Item count for an order line | Domain Shared VO | Integer constrained to `1..100` |
| `OrderConfirmedEvent` | Event emitted when `Order` transitions `Draft -> Confirmed` | Domain Order Event | Includes `orderId` and `totalAmount` |
| `OrderCancelledEvent` | Event emitted when `Order` transitions to `Cancelled` | Domain Order Event | Includes `orderId` and `previousStatus` |
| `OrderRepository` | Persistence port for `Order` aggregates | Domain Order Port | Implemented in `infrastructure/persistence/order/` |
| `InventoryPort` | ACL port reserving product stock | Application Shared Port | Implemented in `infrastructure/acl/inventory/` |
| `PaymentPort` | ACL port capturing payment | Application Shared Port | Implemented in `infrastructure/acl/payment/` |
| `DomainError` | Discriminated union of all domain/infra failures | Domain Shared Error | Returned inside `Result.Err` |
