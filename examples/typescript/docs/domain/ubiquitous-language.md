# Ubiquitous Language — ordering

> Single Bounded Context repository: **ordering-ts** (`ordering`)
> Every term defined here MUST match identifiers in OpenSpec specs, domain code, and tests.

| Term (English Identifier) | Domain Meaning | Layer / Pattern | Notes |
| :--- | :--- | :--- | :--- |
| `Result<T, E>` | Explicit success (`Ok`) or typed failure (`Err`) | Domain Base | All expected failures are values |
| `Order` | Aggregate root representing a customer order | Aggregate Root | States: `Draft`, `Confirmed`, `Cancelled` |
| `OrderLine` | Single product line in an order | Entity | Holds `ProductId`, `Quantity`, unit `Money` |
| `OrderId` | Unique identifier for an `Order` | Value Object | Non-empty trimmed string |
| `CustomerId` | Identifier of the ordering customer | Value Object | Non-empty trimmed string |
| `ProductId` | Identifier of an ordered product | Value Object | Unique per `Order` |
| `Money` | Integer minor-unit monetary value + `Currency` (`JPY` / `USD`) | Value Object | Non-negative; operations enforce same currency |
| `Quantity` | Item count for an order line | Value Object | Integer constrained to `1..100` |
| `OrderConfirmedEvent` | Event emitted when `Order` transitions `Draft -> Confirmed` | Domain Event | Includes `orderId` and `totalAmount` |
| `OrderCancelledEvent` | Event emitted when `Order` transitions to `Cancelled` | Domain Event | Includes `orderId` and `previousStatus` |
| `OrderRepository` | Persistence port for `Order` aggregates | Domain Port | Implemented via `DriverOrderRepository` |
| `InventoryPort` | ACL port reserving product stock | Domain Port | Implemented via `InventoryGateway` |
| `PaymentPort` | ACL port capturing payment | Domain Port | Implemented via `PaymentGateway` |
| `DomainError` | Discriminated union of all domain/infra failures | Domain Error | Returned inside `Result.Err` |
