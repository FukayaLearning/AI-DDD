# Test Plan

## Test Scope

- **Capabilities**: `ordering/order-management` (`REQ-ORD-001`..`REQ-ORD-004`, `SCN-ORD-001-01`..`SCN-ORD-004-01`).
- **Design Elements**: value objects, `Order` aggregate (encapsulation, create/reconstitute, identity equality, event lifecycle, version), mapper, repository, inventory/payment gateways, event publisher, application use cases, Web UI controller/views.
- **Out of Scope**: production message broker/outbox integration, multi-writer distributed locking, and new business capabilities.

## Test Levels & Responsibilities

- **Unit (`UT-`)**: domain invariants, value-object validation, aggregate encapsulation, factory separation, identity equality, event lifecycle, mappers, repositories (version conflict), gateways (reserve/release, charge/refund), event publisher, application use cases, and Web UI branches.
- **Integration (`IT-`)**: real binary process with file KV and HTTP stubs, covering the full lifecycle, invalid input, invalid transitions, stock/payment/timeout/unavailable failures, persistence failure, missing order, multi-line orders, and localization.

## Environment & Test Doubles

- Unit tests use mock KV drivers, mock HTTP drivers, mock ports, and a recording event publisher.
- Integration tests use configurable inventory/payment HTTP stubs and a temporary data directory.
- Distribution artifact: standalone Node.js process (`binary`).

## Entry & Exit Criteria

- Entry: planning artifacts complete; schema v4 applied.
- Exit: every test case passes, `ai-ddd trace --check` passes, and 100% C1 branch coverage outside `infrastructure/drivers/` and `main` is achieved.

## Non-Functional Testing

- Performance/security/availability tests are not required for this reference implementation; the integration test verifies timeout behavior and compensation.

## Abnormal-Path Checklist

| Category | Case IDs | N/A Reason |
| :--- | :--- | :--- |
| Input boundary & invalid values | `IT-ORD-002` | |
| Invalid state transition | `IT-ORD-003` | |
| External dependency failure | `IT-ORD-004`, `IT-ORD-005`, `IT-ORD-006`, `IT-ORD-007` | |
| Persistence / storage failure | `IT-ORD-008` | |
| Duplicate / concurrent conflict | | Single-process local KV; version conflict covered by `UT-ORD-066` |
| Target not found | `IT-ORD-009` | |
| Locale-specific rendering | `IT-ORD-010` | |

## Test Case Delta

- **Added**: `UT-ORD-032`..`UT-ORD-039`, `UT-ORD-040`..`UT-ORD-068`, `IT-ORD-011`.
- **Changed**: `UT-ORD-021`..`UT-ORD-031` updated for event publication, compensation, versioning, and 1-to-1 scenario mapping.
- **Retired**: none.
