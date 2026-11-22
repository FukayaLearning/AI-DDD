# Proposal

## Why

The Ordering Bounded Context needs a complete order lifecycle capability (creation, confirmation with external inventory reservation and payment capture, cancellation, and Web UI inspection) modeled strictly with DDD and verified to 100% C1 coverage in Go.

## Bounded Context & Ubiquitous Language

- **Bounded Context**: `ordering` (1 repository = 1 Bounded Context)
- **External Contexts**: `inventory` and `payment` reside in separate repositories (`T.B.D.` for cross-repo OpenSpec linking), accessed via Anti-Corruption Layer (ACL) ports.
- **New / Updated Terms** (synced with `docs/domain/ubiquitous-language.md`):
  - `Order`, `OrderLine`, `OrderId`, `CustomerId`, `ProductId`, `Money`, `Quantity`, `OrderConfirmedEvent`, `OrderCancelledEvent`.

## What Changes

- Introduce order creation, confirmation, cancellation, and detail lookup capabilities in Go.
- Implement layer-first 4-layer DDD (`internal/{domain,application,infrastructure,presentation}` + `cmd/server`) with `Result[T, E]`.
- Expose an SSR HTML Web UI tested with Mock UseCases + Headless Chromium.

## Capabilities

### New Capabilities
- `ordering/order-management`: Order creation, confirmation with stock reservation and payment capture, cancellation, and Web UI lifecycle management.

### Modified Capabilities
<!-- None -->

## Impact

- **Domain Model**: `Order`, `OrderLine`, `OrderId`, `CustomerId`, `ProductId`, `Money`, `Quantity`, `OrderRepository`, `InventoryPort`, `PaymentPort`, `DomainError`.
- **Application UseCases**: `OrderApplicationService`.
- **Infrastructure**: `OrderMapper`, `DriverOrderRepository`, `InventoryGateway`, `PaymentGateway`, branchless `internal/infrastructure/drivers/`.
- **Presentation**: SSR Web UI routes (`GET /`, `GET /orders/:id`, `POST /orders`, `POST /orders/:id/confirm`, `POST /orders/:id/cancel`).
- **Distribution / Integration**: Compiled Go binary `cmd/server` integrating real `FileKvDriver` and `NetHttpJsonDriver`.
