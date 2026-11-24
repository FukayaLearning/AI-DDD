# ordering/order-management Specification

## Purpose
Manages the complete lifecycle of customer orders within the Ordering Bounded Context, enforcing order invariants, coordinating inventory and payment through anti-corruption layers, and rendering the order lifecycle in the Web UI.

## Requirements

### Requirement: REQ-ORD-001 Place a new draft order
The system SHALL allow placing a new `Draft` order with 1 to 5 unique-product `OrderLine` entries using matching currencies, positive quantities (1..100), and non-negative unit amounts.

#### Scenario: SCN-ORD-001-01 Place valid draft order
- **GIVEN** a valid `OrderId`, `CustomerId`, and 1 to 5 unique `OrderLine` entries with matching currency
- **WHEN** the user places the order
- **THEN** the system persists a `Draft` order and returns its total amount

#### Scenario: SCN-ORD-001-02 Reject order violating domain invariants
- **GIVEN** empty lines, more than 5 lines, duplicate `ProductId`, mismatched currencies, or invalid `Quantity`/`Money`
- **WHEN** the user places the order
- **THEN** the system rejects the request with a domain validation error and does not save the order

#### Scenario: SCN-ORD-001-03 Surface storage failure
- **GIVEN** a valid order request whose storage is unavailable
- **WHEN** the system attempts to persist the order
- **THEN** the system reports a storage failure to the user and does not save the order

### Requirement: REQ-ORD-002 Confirm a draft order with inventory and payment
The system SHALL confirm a `Draft` order only after reserving inventory and capturing payment, emitting `OrderConfirmedEvent`, and SHALL compensate external effects when a later step fails.

#### Scenario: SCN-ORD-002-01 Confirm draft order successfully
- **GIVEN** an existing `Draft` order and available inventory and approved payment
- **WHEN** the user confirms the order
- **THEN** the order transitions to `Confirmed`, `OrderConfirmedEvent` is published, and the order is saved

#### Scenario: SCN-ORD-002-02 Fail confirmation when order is missing or not draft
- **GIVEN** a missing order or an order already in `Confirmed` or `Cancelled` status
- **WHEN** the user confirms the order
- **THEN** the system rejects the confirmation and reports that the order cannot be confirmed

#### Scenario: SCN-ORD-002-03 Fail confirmation on insufficient stock, declined payment, or timeout
- **GIVEN** an existing `Draft` order and an inventory shortage, payment decline, or external timeout
- **WHEN** the user confirms the order
- **THEN** the system reports the failure, keeps the order `Draft`, and releases any inventory reservation already made

### Requirement: REQ-ORD-003 Cancel an order
The system SHALL allow cancelling a `Draft` or `Confirmed` order, emitting `OrderCancelledEvent`, compensating reserved inventory and captured payment for confirmed orders, and SHALL reject cancelling an already `Cancelled` order.

#### Scenario: SCN-ORD-003-01 Cancel draft or confirmed order
- **GIVEN** an existing `Draft` or `Confirmed` order
- **WHEN** the user cancels the order
- **THEN** the order transitions to `Cancelled`, `OrderCancelledEvent` is published, and the order is saved

#### Scenario: SCN-ORD-003-02 Reject cancelling an already cancelled order
- **GIVEN** an existing `Cancelled` order
- **WHEN** the user cancels the order again
- **THEN** the system rejects the cancellation and reports that the order is already cancelled

### Requirement: REQ-ORD-004 Inspect and operate orders in Web UI
The system SHALL render Web UI pages to create, view, confirm, and cancel orders, reflecting order status, action availability, and domain/system error messages.

#### Scenario: SCN-ORD-004-01 Render order lifecycle and error messages in browser
- **GIVEN** the Web UI served with application use cases
- **WHEN** a user submits order forms with 1 to 5 lines, clicks Confirm or Cancel, triggers validation/domain errors, or visits an unknown order
- **THEN** the browser renders the order status, total amount, line table, conditional action controls, or a localized error message
