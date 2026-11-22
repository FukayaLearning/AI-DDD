# Tasks

## 1. Strategic Docs & Domain Layer TDD (100% C1)

- [x] 1.1 Sync `docs/domain/ubiquitous-language.md` and `docs/domain/context-map.md`
- [x] 1.2 Implement Domain Value Objects, Aggregate, Events, Ports, and unit tests to 100% C1 coverage

## 2. Infrastructure Layer 3-Part TDD (100% C1 outside `drivers/`)

- [x] 2.1 Implement pure `OrderMapper` and unit tests to 100% C1 coverage
- [x] 2.2 Implement branchless `KvDriver` and `HttpJsonDriver` under `src/infrastructure/drivers/`
- [x] 2.3 Implement `DriverOrderRepository`, `InventoryGateway`, `PaymentGateway`, and mock-driver abnormal-path unit tests to 100% C1 coverage

## 3. Application Layer Scenario TDD (100% C1)

- [x] 3.1 Implement `OrderApplicationService` and 1-to-1 OpenSpec scenario tests to 100% C1 coverage

## 4. Presentation Layer Mock x Chromium Web UI TDD (100% C1)

- [x] 4.1 Implement `OrderWebServer` and run Mock + Headless Chromium browser tests across all UI branches to 100% C1 coverage

## 5. Governance & Integration Verification

- [x] 5.1 Run `ai-ddd verify`, C1 100% coverage suite, and binary process integration test
