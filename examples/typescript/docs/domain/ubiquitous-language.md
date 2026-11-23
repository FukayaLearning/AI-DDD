# Ubiquitous Language — ordering

> Single Bounded Context repository: **ordering-ts** (`ordering`, `ORD`)
> Every term defined here MUST match identifiers in OpenSpec specs, domain code, and tests.

| Term (English Identifier) | Domain Meaning | Layer / Pattern | Notes |
| :--- | :--- | :--- | :--- |
| `Result<T, E>` | Explicit success (`Ok`) or typed failure (`Err`) | Domain Shared | `domain/shared/result.ts`; all expected errors are values |
| `Order` | Aggregate root representing a customer order | Domain Entity | `domain/entities/order/`; states: `Draft`, `Confirmed`, `Cancelled` |
| `OrderLine` | Single product line in an order | Domain Entity | `domain/entities/order/`; holds `ProductId`, `Quantity`, unit `Money` |
| `OrderId` | Unique identifier for an `Order` | Domain Shared VO | `domain/value_objects/shared/`; non-empty trimmed string |
| `CustomerId` | Identifier of the ordering customer | Domain Shared VO | `domain/value_objects/shared/`; non-empty trimmed string |
| `ProductId` | Identifier of an ordered product | Domain Shared VO | `domain/value_objects/shared/`; unique per `Order` |
| `Money` | Integer minor-unit monetary value + `Currency` (`JPY` / `USD`) | Domain Shared VO | `domain/value_objects/shared/`; non-negative; operations enforce same currency |
| `Quantity` | Item count for an order line | Domain Order VO | `domain/value_objects/order/`; integer constrained to `1..100` |
| `OrderConfirmedEvent` | Event emitted when `Order` transitions `Draft -> Confirmed` | Domain Order Event | `domain/entities/order/`; includes `orderId` and `totalAmount` |
| `OrderCancelledEvent` | Event emitted when `Order` transitions to `Cancelled` | Domain Order Event | `domain/entities/order/`; includes `orderId` and `previousStatus` |
| `OrderRepository` | Persistence port for `Order` aggregates | Domain Order Repository Port | Declared in `domain/repositories/order/`, implemented in `infrastructure/repositories/order/` |
| `InventoryPort` | ACL port reserving product stock | Application Port | Declared in `application/ports/inventory/`, implemented in `infrastructure/gateways/inventory/` |
| `PaymentPort` | ACL port capturing payment | Application Port | Declared in `application/ports/payment/`, implemented in `infrastructure/gateways/payment/` |
| `DomainError` | Discriminated union of all domain/infra failures | Domain Shared Error | `domain/shared/errors.ts`; returned inside `Result.Err` |
