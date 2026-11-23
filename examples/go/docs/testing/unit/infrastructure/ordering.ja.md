<!-- ai-ddd-translation: source=ordering.md sha256=e5307393625358c6c64bd4b9fe15009f01339ca1ce61e978d4416d4e765579b7 locale=ja -->

# 単体試験仕様書 — infrastructure/mappers/order, infrastructure/repositories/order, infrastructure/gateways/{inventory,payment}

| ID | 設計要素 | 試験技法 | 入力 | 期待結果 | 根拠 | 自動試験 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `UT-ORD-014` | `order_mapper` | 同値分割 | 有効なレコードと不正な `id`/`customerId`/`productId`/`quantity`/`unitAmount`/`lines` | `Ok(Order)` または `Err(REPOSITORY_ERROR)` | `REQ-ORD-001` | `internal/*/*/*_test.go` |
| `UT-ORD-015` | `DriverOrderRepository` | モックドライバー（正常・未存在） | インメモリのモック KV ドライバー（`save`・`findById`・存在しないキー `ENOENT`） | `Ok` / `Err(ORDER_NOT_FOUND)` | `REQ-ORD-001` | `internal/*/*/*_test.go` |
| `UT-ORD-016` | `DriverOrderRepository` | モックドライバー障害 | I/O エラーを送出する、または壊れた JSON を返すドライバー | `Err(REPOSITORY_ERROR)` | `SCN-ORD-001-03` | `internal/*/*/*_test.go` |
| `UT-ORD-017` | `InventoryGateway` | モック HTTP 応答 | HTTP 200 / HTTP 409 | `Ok` / `Err(INSUFFICIENT_STOCK)` | `SCN-ORD-002-03` | `internal/*/*/*_test.go` |
| `UT-ORD-018` | `InventoryGateway` | モック HTTP 障害 | HTTP 500 / ネットワークタイムアウト | `Err(EXTERNAL_TIMEOUT)` | `SCN-ORD-002-03` | `internal/*/*/*_test.go` |
| `UT-ORD-019` | `PaymentGateway` | モック HTTP 応答 | HTTP 200 / HTTP 402 | `Ok` / `Err(PAYMENT_DECLINED)` | `SCN-ORD-002-03` | `internal/*/*/*_test.go` |
| `UT-ORD-020` | `PaymentGateway` | モック HTTP 障害 | HTTP 503 / ネットワークタイムアウト | `Err(EXTERNAL_TIMEOUT)` | `SCN-ORD-002-03` | `internal/*/*/*_test.go` |
