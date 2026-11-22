<!-- ai-ddd-translation: source=order-management.md sha256=88e9777b4c268521daf8a7e4c873b11595286ceb791db532950e69d33f2ef9aa locale=ja -->

# Integration Test Specification — ordering/order-management

## Test Cases

| ID | Title | Traces (SCN) | Technique | Preconditions (GIVEN) | Steps (WHEN) | Expected (THEN) | Priority | Automated Test |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `IT-ORD-001` | Full order lifecycle (Draft -> Confirmed -> Cancelled) | `SCN-ORD-001-01`, `SCN-ORD-002-01`, `SCN-ORD-003-01`, `SCN-ORD-004-01` | Scenario E2E | Real server running with writable data dir and 200 OK external stubs | POST `/orders`, POST `/orders/{id}/confirm`, POST `/orders/{id}/cancel` | Status transitions `Draft` -> `Confirmed` -> `Cancelled`, total rendered, JSON persisted | P1 | `scripts/test-integration.sh` |
| `IT-ORD-002` | Reject invalid order input in E2E | `SCN-ORD-001-02` | Boundary value | Real server running | POST `/orders` with `quantity=0` | HTTP 422 with `INVALID_QUANTITY` error banner and no file persisted | P1 | `scripts/test-integration.sh` |
| `IT-ORD-003` | Reject invalid state transition | `SCN-ORD-002-02`, `SCN-ORD-003-02` | State transition | Cancelled order persisted | POST `/orders/{id}/confirm` and `/orders/{id}/cancel` | HTTP 422 with `INVALID_ORDER_STATE` | P1 | `scripts/test-integration.sh` |
| `IT-ORD-004` | Confirm fails on inventory shortage | `SCN-ORD-002-03` | Error guessing | `Draft` order persisted; inventory stub returns 409 | POST `/orders/{id}/confirm` | HTTP 422 with `INSUFFICIENT_STOCK`; persisted order remains `Draft` | P1 | `scripts/test-integration.sh` |
| `IT-ORD-005` | Confirm fails on payment decline | `SCN-ORD-002-03` | Error guessing | `Draft` order persisted; inventory stub 200, payment stub 402 | POST `/orders/{id}/confirm` | HTTP 422 with `PAYMENT_DECLINED`; persisted order remains `Draft` | P1 | `scripts/test-integration.sh` |
| `IT-ORD-006` | Confirm fails on external timeout | `SCN-ORD-002-03` | Error guessing | `Draft` order persisted; payment stub delays beyond `HTTP_TIMEOUT_MS` | POST `/orders/{id}/confirm` | HTTP 422 with `EXTERNAL_TIMEOUT`; persisted order remains `Draft` | P2 | `scripts/test-integration.sh` |
| `IT-ORD-007` | Confirm fails when external service unavailable | `SCN-ORD-002-03` | Error guessing | `Draft` order persisted; inventory URL points to closed port | POST `/orders/{id}/confirm` | HTTP 422 with `EXTERNAL_TIMEOUT`; persisted order remains `Draft` | P2 | `scripts/test-integration.sh` |
| `IT-ORD-008` | Place order fails on persistence error | `SCN-ORD-001-03` | Fault injection | Server configured with read-only data directory | POST `/orders` with valid payload | HTTP 422 with `REPOSITORY_ERROR` and no order file created | P1 | `scripts/test-integration.sh` |
| `IT-ORD-009` | Get unknown order returns 404 | `SCN-ORD-002-02`, `SCN-ORD-004-01` | Equivalence partitioning | Real server running | GET `/orders/NO-SUCH` | HTTP 404 with `ORDER_NOT_FOUND` | P2 | `scripts/test-integration.sh` |
| `IT-ORD-010` | Localized Web UI rendering (`ja` & `en`) | `SCN-ORD-004-01` | Equivalence partitioning | Servers started with default `ja` and `APP_LOCALE=en` | GET `/` on each server | `<html lang="ja">` with Japanese labels vs `<html lang="en">` with English labels | P2 | `scripts/test-integration.sh` |

## Abnormal-Path Checklist

| Category | Case IDs | N/A Reason |
| :--- | :--- | :--- |
| Input boundary & invalid values | `IT-ORD-002` | |
| Invalid state transition | `IT-ORD-003` | |
| External dependency failure (timeout / declined / unavailable) | `IT-ORD-004`, `IT-ORD-005`, `IT-ORD-006`, `IT-ORD-007` | |
| Persistence / storage failure | `IT-ORD-008` | |
| Duplicate / concurrent conflict | | Single-process local KV file storage without concurrent multi-writer locking |
| Target not found | `IT-ORD-009` | |
| Locale-specific rendering | `IT-ORD-010` | |
