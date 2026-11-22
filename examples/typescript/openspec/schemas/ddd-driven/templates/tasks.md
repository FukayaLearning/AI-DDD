# Tasks

## 1. Strategic Docs & Domain Layer TDD (100% C1)

- [ ] 1.1 Update `docs/domain/ubiquitous-language.md` and `docs/domain/context-map.md` and verify terminology matches proposal/specs
- [ ] 1.2 Write Domain unit tests for Value Objects, Aggregate invariants, `Result` error branches, and Domain Events, then implement `domain/` to 100% C1 branch coverage

## 2. Infrastructure Layer 3-Part TDD (100% C1 outside `drivers/`)

- [ ] 2.1 Write unit tests for pure Mappers and ACL converters, then implement them to 100% C1 branch coverage
- [ ] 2.2 Define minimal branchless `infrastructure/drivers/` interfaces and raw driver implementations (verify zero `if`/`switch`/`match` branches)
- [ ] 2.3 Write unit tests with mock drivers for all abnormal paths (timeouts, conflicts, HTTP errors, storage failures) and implement Repositories/Gateways to 100% C1 branch coverage

## 3. Application Layer Scenario TDD (100% C1)

- [ ] 3.1 Write Application UseCase tests mapped 1-to-1 to every OpenSpec `#### Scenario:` using DI mock ports, then implement `application/` to 100% C1 branch coverage

## 4. Presentation Layer Mock x Playwright Web UI TDD (100% C1)

- [ ] 4.1 Launch Presentation Web server with DI-injected Mock UseCases under coverage instrumentation and run headless browser (Playwright/Chromium) tests across all normal, validation-error, domain-error, system-error, and 404 paths until 100% Presentation C1 coverage passes

## 5. Governance, Distribution & Integration Verification

- [ ] 5.1 Run static governance check (`ai-ddd verify`) and confirm 0 layer violations, 0 inline coverage ignores, and 0 branches in `drivers/`
- [ ] 5.2 Execute distribution integration tests (`docker` / `binary` / `library`) verifying `infrastructure/drivers/` and `main`

## 6. Multi-Agent Verification & Zero-Context Review

- [ ] 6.1 Run lightweight execution subagent (`flash`/`flash_lite`) to confirm clean build, 100% C1 unit+browser coverage, and integration pass
- [ ] 6.2 Run zero-context independent review subagent (`pro`) over saved artifacts only (spec alignment, Ubiquitous Language consistency, and C1 governance audit)
