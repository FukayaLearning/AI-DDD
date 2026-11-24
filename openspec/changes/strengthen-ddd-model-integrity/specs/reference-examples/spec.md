# reference-examples Spec Delta

## MODIFIED Requirements

### Requirement: Consistent Ordering domain model across all four languages
Each example under `examples/{typescript,python,go,rust}/` SHALL implement the Ordering Bounded Context using layer-first 4-layer DDD (`domain`, `application`, `infrastructure`, `presentation` plus `main` composition root), `Result<T, E>` error values, and OpenSpec `ddd-driven` artifacts. Each example SHALL encapsulate aggregate and value-object state, separate aggregate creation from reconstitution, define entity equality by identity, and define an explicit domain-event lifecycle.

#### Scenario: Domain invariants enforce business rules via Result
- **GIVEN** an `Order` aggregate with `OrderId`, `Money`, `Quantity`, and `OrderLine` value objects or local entities
- **WHEN** creating an order with empty lines, >5 lines, duplicate product IDs, invalid quantity, or mismatched currency, or cancelling an already cancelled order
- **THEN** the domain returns an `Err(DomainError)` value without throwing domain exceptions

#### Scenario: Aggregate and value-object state cannot be mutated externally
- **GIVEN** an `Order` aggregate and its value objects in any of the four languages
- **WHEN** code outside the aggregate attempts to assign a status, replace lines, or construct an invalid value object without the domain factory
- **THEN** the language's visibility or type system prevents the mutation or construction, or the domain factory rejects it with a typed error

#### Scenario: Creation and reconstitution are separate paths
- **GIVEN** the `Order` factory API
- **WHEN** a caller attempts to create a new order with `Confirmed` or `Cancelled` status, or reconstitute an order with invalid lines or negative version
- **THEN** the new-creation path always initializes `Draft` with empty events and `version = 0`, and only the reconstitution path accepts persisted status and version with invariant validation and empty pending events

#### Scenario: Entity equality uses identity
- **GIVEN** two `Order` instances with the same `OrderId` but different status, lines, version, or events
- **WHEN** the domain compares them for equality
- **THEN** they are equal because equality is defined by `OrderId`, not by all attributes

#### Scenario: Domain events have an explicit lifecycle
- **GIVEN** a confirmed or cancelled order
- **WHEN** the application layer persists the aggregate and invokes `DomainEventPublisher`
- **THEN** the recorded events are pulled/published after successful `save` and cleared from the aggregate, and the persistence mapper does not store transient domain events in database records

#### Scenario: Confirmation uses the post-transition aggregate and defines compensation
- **GIVEN** a draft order being confirmed
- **WHEN** inventory reservation or payment succeeds but a subsequent step or persistence fails, or a confirmed order is cancelled
- **THEN** external calls use the post-transition aggregate's identity (`orderId` idempotency key) and total, and compensation (`releaseStock` / `refund`) is executed before returning or saving

#### Scenario: Optimistic concurrency and error separation
- **GIVEN** an `Order` aggregate with a `version` attribute and separated `DomainError` and `InfrastructureError` types
- **WHEN** a repository `save` detects a version mismatch or a storage/gateway failure occurs
- **THEN** the repository returns a concurrency conflict or `InfrastructureError`, keeping `DomainError` strictly for domain invariant violations

#### Scenario: OrderLine classification matches the model
- **GIVEN** the `OrderLine` type and the ubiquitous-language definition
- **WHEN** the ACL inventory port is invoked
- **THEN** `OrderLine` is classified consistently as a value object or local entity, and the port receives a DTO rather than the aggregate's internal collection

## ADDED Requirements

### Requirement: Examples demonstrate schema-compliant archives and language consistency
Each example SHALL include archived change artifacts that conform to the current `ddd-driven` schema version, and its ubiquitous language, specifications, code identifiers, and tests SHALL use the same domain terms. Specifications SHALL describe observable domain behavior without internal class names, error codes, framework names, or SQL/HTTP details.

#### Scenario: Archived change artifacts match the current schema
- **GIVEN** an example's `openspec/changes/archive/<date>-add-order-management/`
- **WHEN** the archive is inspected
- **THEN** it contains `proposal.md`, `specs/` with `REQ-`/`SCN-` identifiers, `design.md`, `test-plan.md`, and `tasks.md`, plus the `i18n/ja/` translations required by the configured locale

#### Scenario: Ubiquitous language matches code and specifications
- **GIVEN** an example's `docs/domain/ubiquitous-language.md`
- **WHEN** its terms are compared with domain identifiers, specifications, and test names
- **THEN** each domain term maps to the same identifier, `OrderLine` is classified consistently, and no technical construction (such as `Result` or a repository port) is presented as a domain-expert term

#### Scenario: Specification avoids implementation leakage
- **GIVEN** an example's capability specification
- **WHEN** a reviewer inspects its requirements and scenarios
- **THEN** they describe observable domain outcomes in ubiquitous language and do not name internal classes, error codes, storage drivers, or rendering technology
