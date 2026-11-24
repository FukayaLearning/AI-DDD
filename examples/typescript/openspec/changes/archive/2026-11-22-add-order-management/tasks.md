# Tasks

## 1. Strategic Docs & Domain Layer TDD (100% C1)

- [x] 1.1 Sync `docs/domain/ubiquitous-language.md` and `docs/domain/context-map.md`, including Core Domain / Generic Subdomain / Shared Kernel decisions
- [x] 1.2 Implement encapsulated Value Objects, `Order.create`/`reconstitute`, identity equality, event pull/clear lifecycle, `Result` totals, separated error types, `version`, and unit tests to 100% C1 coverage

## 2. Infrastructure Layer 3-Part TDD (100% C1 outside `drivers/`)

- [x] 2.1 Implement pure `OrderMapper` (no event persistence) and unit tests to 100% C1 coverage
- [x] 2.2 Implement branchless `KvDriver` and `HttpJsonDriver` under `src/infrastructure/drivers/`
- [x] 2.3 Implement `DriverOrderRepository` (version conflict), `InventoryGateway` / `PaymentGateway` (reserve/release, charge/refund), `LoggingEventPublisher`, and mock-driver abnormal-path unit tests to 100% C1 coverage

## 3. Application Layer Scenario TDD (100% C1)

- [x] 3.1 Implement `OrderApplicationService`, `DomainEventPublisher` publication after save, compensation, post-transition aggregate use, and 1-to-1 OpenSpec scenario tests to 100% C1 coverage

## 4. Presentation Layer Mock x Chromium Web UI TDD (100% C1)

- [x] 4.1 Implement the Web UI server with `canConfirm`/`canCancel`, safe input parsing, 1..5 line form, and run Mock + Headless Chromium browser tests across all UI branches to 100% C1 coverage

## 5. Governance & Integration Verification

- [x] 5.1 Run `ai-ddd verify`, `ai-ddd trace --check`, C1 100% coverage suite, and binary process integration test
