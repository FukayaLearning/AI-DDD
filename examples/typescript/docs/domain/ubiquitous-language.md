# Ubiquitous Language — ordering

> Single Bounded Context repository: **ordering-ts** (`ordering`, `ORD`)
> Every domain term below MUST match identifiers in OpenSpec specs, domain code, and tests.

## Domain Terms

| Term (English Identifier) | Domain Meaning | Layer / Pattern | Notes |
| :--- | :--- | :--- | :--- |
| `Order` | Aggregate root representing a customer order | Domain Entity | `domain/entities/order/`; states: `Draft`, `Confirmed`, `Cancelled`; carries `version` for optimistic concurrency |
| `OrderLine` | Single product line inside an order | Aggregate-internal Value Object | `domain/entities/order/`; holds `ProductId`, `Quantity`, unit `Money`; no identity of its own |
| `OrderId` | Unique identifier for an `Order` | Domain Shared VO | `domain/value_objects/shared/`; non-empty trimmed string |
| `CustomerId` | Identifier of the ordering customer | Domain Shared VO | `domain/value_objects/shared/`; non-empty trimmed string |
| `ProductId` | Identifier of an ordered product | Domain Shared VO | `domain/value_objects/shared/`; unique per `Order` |
| `Money` | Integer minor-unit monetary value + `Currency` (`JPY` / `USD`) | Domain Shared VO | `domain/value_objects/shared/`; non-negative; arithmetic enforces same currency and overflow |
| `Quantity` | Item count for an order line | Domain Order VO | `domain/value_objects/order/`; integer constrained to `1..100` |
| `OrderStatus` | Lifecycle state of an `Order` | Domain Order VO | `Draft` / `Confirmed` / `Cancelled` |
| `Currency` | Monetary currency | Domain Shared VO | `JPY` / `USD` |
| `OrderConfirmedEvent` | Event recorded when `Order` transitions `Draft -> Confirmed` | Domain Order Event | Includes `orderId` and `totalAmount` |
| `OrderCancelledEvent` | Event recorded when `Order` transitions to `Cancelled` | Domain Order Event | Includes `orderId` and `previousStatus` |

## Technical Terms (not domain-expert vocabulary)

- `Result<T, E>`: explicit success or typed failure value used across all layers.
- `DomainError`: domain invariant violation.
- `InfrastructureError`: persistence or external-service failure.
- `OrderError`: discriminated union of `DomainError` and `InfrastructureError`.
- `OrderRepository`: persistence port owned by the domain.
- `InventoryPort` / `PaymentPort`: application ports for external contexts (ACL).
- `DomainEventPublisher`: application port that publishes pulled domain events.
- `OrderSummaryDto` / `PlaceOrderCommand`: application DTOs.
