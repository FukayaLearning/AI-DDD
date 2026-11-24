<!-- ai-ddd-translation: source=ordering.md sha256=20b7611fe1cfee8d879d0ac75713d63b1a0cc2d1c06ae57747feda24b64dda3b locale=ja -->

# 単体テスト仕様 — infrastructure/mappers/order, infrastructure/repositories/order, infrastructure/gateways/{inventory,payment,events}

| ID | 設計要素 | 技法 | 入力 | 期待結果 | 根拠 | 自動テスト |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `UT-ORD-014` | `order_mapper` | 同値分割 | 有効なレコード、version なしの旧レコード、不正なフィールド/version/status | `Ok(Order)` または `Err(REPOSITORY_ERROR)`、イベントは永続化しない | `SCN-ORD-001-02` | `tests/unit/infrastructure.test.mjs` |
| `UT-ORD-015` | `DriverOrderRepository` | モックドライバ正常・未存在 | インメモリ KV ドライバ（`save`, `findById`, 欠落キー `ENOENT`） | `Ok` / `Err(ORDER_NOT_FOUND)`、version を増分 | `SCN-ORD-001-01` | `tests/unit/infrastructure.test.mjs` |
| `UT-ORD-016` | `DriverOrderRepository` | モックドライバ障害 | I/O 例外または破損 JSON | `Err(REPOSITORY_ERROR)` | `SCN-ORD-001-03` | `tests/unit/infrastructure.test.mjs` |
| `UT-ORD-017` | `InventoryGateway` 引当 | モック HTTP 応答 | HTTP 200 / HTTP 409 | `Ok` / `Err(INSUFFICIENT_STOCK)` | `SCN-ORD-002-03` | `tests/unit/infrastructure.test.mjs` |
| `UT-ORD-018` | `InventoryGateway` 引当 | モック HTTP 障害 | HTTP 500 / ネットワークタイムアウト | `Err(EXTERNAL_TIMEOUT)` | `SCN-ORD-002-03` | `tests/unit/infrastructure.test.mjs` |
| `UT-ORD-019` | `PaymentGateway` 決済 | モック HTTP 応答 | HTTP 200 / HTTP 402 | `Ok` / `Err(PAYMENT_DECLINED)` | `SCN-ORD-002-03` | `tests/unit/infrastructure.test.mjs` |
| `UT-ORD-020` | `PaymentGateway` 決済 | モック HTTP 障害 | HTTP 503 / ネットワークタイムアウト | `Err(EXTERNAL_TIMEOUT)` | `SCN-ORD-002-03` | `tests/unit/infrastructure.test.mjs` |
| `UT-ORD-061` | `InventoryGateway` 解放 | モック HTTP 応答 | HTTP 200 / HTTP 500 / タイムアウト | `Ok` / `Err(EXTERNAL_TIMEOUT)` | `SCN-ORD-002-03` | `tests/unit/infrastructure.test.mjs` |
| `UT-ORD-062` | `PaymentGateway` 返金 | モック HTTP 応答 | HTTP 200 / HTTP 500 / タイムアウト | `Ok` / `Err(EXTERNAL_TIMEOUT)` | `SCN-ORD-002-03` | `tests/unit/infrastructure.test.mjs` |
| `UT-ORD-065` | `LoggingEventPublisher` | 同値分割 | 引き出したイベントと空リスト | イベントをログ出力し `Ok` | `SCN-ORD-002-01` | `tests/unit/infrastructure.test.mjs` |
| `UT-ORD-066` | `DriverOrderRepository` | 状態遷移 | 古い version での保存 | `Err(CONFLICT)` | `SCN-ORD-002-03` | `tests/unit/infrastructure.test.mjs` |
| `UT-ORD-067` | `DriverOrderRepository` | 同値分割 | `version` を持たない旧レコード | version 0 として扱い、保存で 1 に増分 | `SCN-ORD-001-01` | `tests/unit/infrastructure.test.mjs` |
| `UT-ORD-068` | `DriverOrderRepository` | 障害注入 | 新規キー参照後の `put` 失敗 | `Err(REPOSITORY_ERROR)` | `SCN-ORD-001-03` | `tests/unit/infrastructure.test.mjs` |
