# Spec Delta

## Purpose

Manages the complete lifecycle of customer orders within the Ordering Bounded Context, enforcing invariants, external inventory/payment orchestration, and Web UI workflows.

## ADDED Requirements

### Requirement: Place a new draft order
The system SHALL allow placing a new `Draft` order with 1 to 5 unique-product `OrderLine` entries using matching currencies, positive quantities (1..100), and non-negative unit amounts.

#### Scenario: Place valid draft order
- **GIVEN** a valid `OrderId`, `CustomerId`, and 1 to 5 unique `OrderLine` entries with matching currency
- **WHEN** the user places the order
- **THEN** the system persists a `Draft` order and returns its total amount

#### Scenario: Reject order violating domain invariants
- **GIVEN** empty lines, more than 5 lines, duplicate `ProductId`, mismatched currencies, or invalid `Quantity`/`Money`
- **WHEN** the user places the order
- **THEN** the system returns a typed `DomainError` (`Err`) without saving

#### Scenario: Surface repository persistence failure
- **GIVEN** a valid order request whose underlying storage driver fails
- **WHEN** the repository persists the order
- **THEN** the system returns `REPOSITORY_ERROR`

### Requirement: Confirm a draft order with inventory and payment
The system SHALL confirm a `Draft` order only after reserving inventory and capturing payment via ACL ports, emitting `OrderConfirmedEvent`.

#### Scenario: Confirm draft order successfully
- **GIVEN** an existing `Draft` order and available inventory and approved payment
- **WHEN** the user confirms the order
- **THEN** the order transitions to `Confirmed`, emits `OrderConfirmedEvent`, and is saved

#### Scenario: Fail confirmation when order is missing or not draft
- **GIVEN** a missing order ID or an order already in `Confirmed` or `Cancelled` status
- **WHEN** the user confirms the order
- **THEN** the system returns `ORDER_NOT_FOUND` or `INVALID_ORDER_STATE`

#### Scenario: Fail confirmation on insufficient stock, declined payment, or timeout
- **GIVEN** an existing `Draft` order and an inventory shortage, payment decline, or external timeout
- **WHEN** the user confirms the order
- **THEN** the system returns `INSUFFICIENT_STOCK`, `PAYMENT_DECLINED`, or `EXTERNAL_TIMEOUT` and keeps the order `Draft`

### Requirement: Cancel an order
The system SHALL allow cancelling a `Draft` or `Confirmed` order, emitting `OrderCancelledEvent`, and SHALL reject cancelling an already `Cancelled` order.

#### Scenario: Cancel draft or confirmed order
- **GIVEN** an existing `Draft` or `Confirmed` order
- **WHEN** the user cancels the order
- **THEN** the order transitions to `Cancelled`, emits `OrderCancelledEvent`, and is saved

#### Scenario: Reject cancelling an already cancelled order
- **GIVEN** an existing `Cancelled` order
- **WHEN** the user cancels the order again
- **THEN** the system returns `INVALID_ORDER_STATE`

### Requirement: Inspect and operate orders in Web UI
The system SHALL render HTML pages to create, view, confirm, and cancel orders, reflecting order status, action availability, and domain/system error banners.

#### Scenario: Render order lifecycle and error banners in browser
- **GIVEN** the SSR Web UI served with application use cases
- **WHEN** a user submits order forms, clicks Confirm or Cancel, triggers validation/domain errors, or visits an unknown order
- **THEN** the browser DOM renders the order status badge, total amount, line table, conditional action buttons, or error banner
