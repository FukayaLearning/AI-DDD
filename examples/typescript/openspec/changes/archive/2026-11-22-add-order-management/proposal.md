# Proposal

## Why

The Ordering Bounded Context needs a complete order lifecycle capability (creation, confirmation with external inventory reservation and payment capture, cancellation, and Web UI inspection) modeled strictly with DDD and verified to 100% C1 coverage.

## Bounded Context & Ubiquitous Language

- **Bounded Context**: `ordering` (platform convention: 1 repository = 1 Bounded Context)
- **Core Domain**: `ordering`; `inventory` and `payment` are Generic/Supporting Subdomains in separate repositories (`T.B.D.` for cross-repo OpenSpec linking), accessed through Anti-Corruption Layer ports.
- **Shared Kernel**: none currently.
- **New / Updated Terms** (synced with `docs/domain/ubiquitous-language.md`):
  - `Order`: Aggregate root managing `OrderLine` items, lifecycle (`Draft` -> `Confirmed` -> `Cancelled`), and an optimistic-concurrency `version`.
  - `OrderId`, `CustomerId`, `ProductId`: Validated non-empty identifier Value Objects.
  - `Money`: Non-negative integer minor-unit amount paired with `Currency` (`JPY` | `USD`).
  - `Quantity`: Positive integer item count constrained between 1 and 100.
  - `OrderLine`: Aggregate-internal Value Object holding `ProductId`, `Quantity`, and unit `Money`; no identity of its own.
  - `OrderConfirmedEvent`, `OrderCancelledEvent`: Domain events recorded on aggregate transitions and published after a successful save.

## What Changes

- Introduce order creation, confirmation (inventory + payment orchestration with compensation), cancellation (with inventory release and refund for confirmed orders), and detail lookup capabilities.
- Add 4-layer DDD implementation (`domain`, `application`, `infrastructure`, `presentation`) using separated `DomainError` / `InfrastructureError` values.
- Expose a Web UI for creating (1..5 lines), inspecting, confirming, and cancelling orders.

## Capabilities

### New Capabilities
- `ordering/order-management`: Order creation, confirmation with stock reservation and payment capture, cancellation, and Web UI lifecycle management.

### Modified Capabilities
<!-- None -->

## Impact

- **Domain Model**: `Order`, `OrderLine`, `OrderId`, `CustomerId`, `ProductId`, `Money`, `Quantity`, `OrderRepository`, `DomainError`, `InfrastructureError`.
- **Application UseCases**: `OrderApplicationService` (`placeOrder`, `confirmOrder`, `cancelOrder`, `getOrder`) and `DomainEventPublisher`.
- **Infrastructure**: `OrderMapper`, `DriverOrderRepository`, `InventoryGateway`, `PaymentGateway`, `LoggingEventPublisher`, branchless `drivers/`.
- **Presentation**: Web UI routes (`GET /`, `GET /orders/:id`, `POST /orders`, `POST /orders/:id/confirm`, `POST /orders/:id/cancel`).
- **Distribution / Integration**: Binary/process server startup integrating real file KV and HTTP drivers.
