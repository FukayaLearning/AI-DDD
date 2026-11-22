# Spec Delta

## Purpose

Defines the four reference Ordering Bounded Context implementations under `examples/{typescript,python,go,rust}/` proving OpenSpec-to-DDD traceability, 100% C1 branch coverage outside exclusions, Mock-backed Chromium Web UI testing, and distribution integration testing.

## ADDED Requirements

### Requirement: Consistent Ordering domain model across all four languages
Each example under `examples/{typescript,python,go,rust}/` SHALL implement the Ordering Bounded Context using layer-first 4-layer DDD (`domain`, `application`, `infrastructure`, `presentation` plus `main` composition root), `Result<T, E>` error values, and OpenSpec `ddd-driven` artifacts.

#### Scenario: Domain invariants enforce business rules via Result
- **GIVEN** an `Order` aggregate with `OrderId`, `Money`, `Quantity`, and `OrderLine` value objects/entities
- **WHEN** creating an order with empty lines, >5 lines, duplicate product IDs, invalid quantity, or mismatched currency, or cancelling an already cancelled order
- **THEN** the domain returns an `Err(DomainError)` value without throwing domain exceptions

### Requirement: Three-part Infrastructure separation and C1 100% coverage
Each example SHALL split `infrastructure` into pure mappers/ACL converters, minimal branchless `drivers/`, and DI-injected repositories/gateways, achieving 100% C1 branch coverage across all non-excluded code.

#### Scenario: Repository and ACL error handling reach 100% C1 coverage via mock drivers
- **GIVEN** mock implementations of `KeyValueStorageDriver` and `HttpJsonDriver` injected into `DriverOrderRepository`, `InventoryGateway`, and `PaymentGateway`
- **WHEN** the unit test suite runs with C1 branch coverage verification excluding only `infrastructure/drivers/` and `main`
- **THEN** all storage, timeout, insufficient-stock, payment-declined, and mapping branches pass with 100% C1 branch coverage

### Requirement: Presentation Web UI verification via Mock and headless browser
Each example SHALL test its HTML SSR Web UI by launching the real HTTP presentation server with mocked Application UseCases, driving all normal and error flows in headless Chromium (Playwright/CDP), and asserting 100% C1 branch coverage in Presentation code.

#### Scenario: Browser renders normal and abnormal order workflows
- **GIVEN** the Presentation server running with mocked Order UseCases
- **WHEN** headless Chromium submits valid and invalid order creation, confirmation, and cancellation forms and visits non-existent order URLs
- **THEN** rendered DOM elements display the expected order state, totals, disabled/enabled action controls, and error banners, covering 100% of Presentation branches
