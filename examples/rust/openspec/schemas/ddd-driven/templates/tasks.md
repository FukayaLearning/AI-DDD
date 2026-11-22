# Tasks

## 1. Strategic Docs, Test Specifications & Domain Layer TDD (100% C1)

- [ ] 1.1 Update `docs/domain/ubiquitous-language.md` and `docs/domain/context-map.md` and verify terminology matches proposal/specs
- [ ] 1.2 Create or update `docs/testing/unit/<layer>/<module>.md` and `docs/testing/integration/<capability>.md` with `UT-`/`IT-` IDs, techniques, expected results, rationales, and the 7-category abnormal-path checklist
- [ ] 1.3 Write Domain unit tests (each named with its `UT-` ID) for Value Objects, Aggregate invariants, `Result` error branches, and Domain Events, then implement `domain/` to 100% C1 branch coverage

## 2. Infrastructure Layer 3-Part TDD (100% C1 outside `drivers/`)

- [ ] 2.1 Write unit tests (with `UT-` IDs) for pure Mappers and ACL converters, then implement them to 100% C1 branch coverage
- [ ] 2.2 Define minimal branchless `infrastructure/drivers/<technology>/` interfaces and raw driver implementations (verify zero `if`/`switch`/`match` branches)
- [ ] 2.3 Write unit tests (with `UT-` IDs) using mock drivers for all abnormal paths (timeouts, conflicts, HTTP errors, storage failures) and implement Repositories/Gateways to 100% C1 branch coverage

## 3. Application Layer Scenario TDD (100% C1)

- [ ] 3.1 Write Application UseCase tests (with `UT-` IDs) mapped 1-to-1 to every OpenSpec `#### Scenario:` using DI mock ports, then implement `application/` (`@implements REQ-...`) to 100% C1 branch coverage

## 4. Presentation Layer Mock x Playwright Web UI TDD (100% C1)

- [ ] 4.1 Launch Presentation Web server with DI-injected Mock UseCases and localized message catalogs (`en` + user locale) under coverage instrumentation, and run headless browser (Playwright/Chromium) tests (with `UT-` IDs) across all normal, validation-error, domain-error, system-error, locale, and 404 paths until 100% Presentation C1 coverage passes

## 5. Governance, Traceability, Distribution & Localization Verification

- [ ] 5.1 Run `ai-ddd trace --check` and generate `docs/traceability/matrix.md`
- [ ] 5.2 Execute distribution integration tests (`docker` / `binary` / `library`) covering all `IT-` normal and abnormal cases verifying `infrastructure/drivers/` and `main`
- [ ] 5.3 Sync translations (`i18n/<locale>/` for change artifacts, `<basename>.<locale>.md` + `ai-ddd i18n stamp` for persistent docs) when user locale is not `en`, then run `ai-ddd verify`

## 6. Multi-Agent Verification & Zero-Context Review

- [ ] 6.1 Run lightweight execution subagent (`flash`/`flash_lite`) to confirm clean build, 100% C1 unit+browser coverage, traceability, and integration pass
- [ ] 6.2 Run zero-context independent review subagent (`pro`) over saved artifacts only (spec alignment, Ubiquitous Language consistency, test specs, localization, and C1 governance audit)
