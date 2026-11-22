# Proposal

## Why

The Ordering Bounded Context needs a complete order lifecycle capability (creation, confirmation with external inventory reservation and payment capture, cancellation, and Web UI inspection) modeled strictly with DDD and verified to 100% C1 coverage.

## Bounded Context & Ubiquitous Language

- **Bounded Context**: `ordering` (1 repository = 1 Bounded Context)
- **External Contexts**: `inventory` and `payment` reside in separate repositories (`T.B.D.` for cross-repo OpenSpec linking), accessed via Anti-Corruption Layer (ACL) ports.
- **New / Updated Terms** (synced with `docs/domain/ubiquitous-language.md`):
  - `Order`: Aggregate root managing `OrderLine` items and lifecycle (`Draft` -> `Confirmed` -> `Cancelled`).
  - `OrderId`, `CustomerId`, `ProductId`: Validated non-empty identifier Value Objects.
  - `Money`: Non-negative integer minor-unit amount paired with `Currency` (`JPY` | `USD`).
  - `Quantity`: Positive integer item count constrained between 1 and 100.
  - `OrderLine`: Line entity holding `ProductId`, `Quantity`, and unit `Money`.
  - `OrderConfirmedEvent`, `OrderCancelledEvent`: Domain events emitted upon aggregate transitions.

## What Changes

- Introduce order creation, confirmation (inventory + payment orchestration), cancellation, and detail lookup capabilities.
- Add 4-layer DDD implementation (`domain`, `application`, `infrastructure`, `presentation`) using `Result<T, E>` error values.
- Expose an SSR HTML Web UI for creating, inspecting, confirming, and cancelling orders.

## Capabilities

### New Capabilities
- `ordering/order-management`: Order creation, confirmation with stock reservation and payment capture, cancellation, and Web UI lifecycle management.

### Modified Capabilities
<!-- None -->

## Impact

- **Domain Model**: `Order`, `OrderLine`, `OrderId`, `CustomerId`, `ProductId`, `Money`, `Quantity`, `OrderRepository`, `InventoryPort`, `PaymentPort`, `DomainError`.
- **Application UseCases**: `OrderApplicationService` (`placeOrder`, `confirmOrder`, `cancelOrder`, `getOrder`).
- **Infrastructure**: `OrderMapper`, `DriverOrderRepository`, `InventoryGateway`, `PaymentGateway`, branchless `drivers/` (`KvDriver`, `HttpJsonDriver`).
- **Presentation**: SSR Web UI routes (`GET /`, `GET /orders/:id`, `POST /orders`, `POST /orders/:id/confirm`, `POST /orders/:id/cancel`).
- **Distribution / Integration**: Binary/process server startup integrating real file KV and HTTP drivers.
