# Unit Test Specification — presentation/controllers/order, presentation/views/order, presentation/i18n

| ID | Design Element | Technique | Input | Expected | Rationale | Automated Test |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `UT-ORD-027` | Order creation form | Headless browser branch | Invalid form submission & valid form submission | Error banner on 422; `Draft` order view with total on 200 | `SCN-ORD-004-01` | `tests/unit/presentation.browser.test.mjs` |
| `UT-ORD-028` | Confirm action | Headless browser branch | Mock `confirmOrder` returning `INSUFFICIENT_STOCK` then `Ok(Confirmed)` | Error banner, then `Confirmed` status and disabled confirm button | `SCN-ORD-004-01` | `tests/unit/presentation.browser.test.mjs` |
| `UT-ORD-029` | Cancel action | Headless browser branch | Mock `cancelOrder` returning `REPOSITORY_ERROR` then `Ok(Cancelled)` | Error banner, then `Cancelled` status and both action buttons disabled | `SCN-ORD-004-01` | `tests/unit/presentation.browser.test.mjs` |
| `UT-ORD-030` | Detail & 404 routes | Headless browser & HTTP branch | Existing order GET, unknown order GET, unknown route GET, unknown POST/PUT | Order detail DOM, `ORDER_NOT_FOUND` banner, 404 Not Found views | `SCN-ORD-004-01` | `tests/unit/presentation.browser.test.mjs` |
| `UT-ORD-031` | Localized UI catalogs | Headless browser branch | Server started with `ja` and `en` message catalogs | Localized headings/buttons and matching `<html lang>` | `REQ-ORD-004` | `tests/unit/presentation.browser.test.mjs` |
