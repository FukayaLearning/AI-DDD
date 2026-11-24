<!-- ai-ddd-translation: source=order.md sha256=64c6a5a039a256cf00873e7ce5edd06c0516a159428ddc4a319b65c255a74204 locale=ja -->

# 単体テスト仕様 — application/services/order, application/dtos/order, application/ports/{inventory,payment,events}

| ID | 設計要素 | 技法 | 入力 | 期待結果 | 根拠 | 自動テスト |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `UT-ORD-021` | `placeOrder` | Scenario 1-to-1 | 有効な `PlaceOrderCommand` | `Ok(Draft)`、合計計算済み、イベントなし | `SCN-ORD-001-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-022` | `placeOrder` | Scenario 1-to-1 | 不正な `orderId`/`customerId`/`productId`/`quantity`/`unitAmount`、空明細 | 対応する `DomainError`、保存なし | `SCN-ORD-001-02` | `tests/unit/application.test.mjs` |
| `UT-ORD-023` | `placeOrder` | Scenario 1-to-1 | リポジトリ障害 | `Err(REPOSITORY_ERROR)` | `SCN-ORD-001-03` | `tests/unit/application.test.mjs` |
| `UT-ORD-024` | `getOrder` | 同値分割 | 空 ID、存在しない ID、既存注文、合計オーバーフロー | `INVALID_ORDER_ID`, `ORDER_NOT_FOUND`, `Ok(dto)`, `INVALID_MONEY_AMOUNT` | `SCN-ORD-004-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-025` | `confirmOrder` | Scenario 1-to-1 | 有効な `Draft` 注文 | `Ok(Confirmed)` と 1 件のイベント発行 | `SCN-ORD-002-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-026` | `confirmOrder` | Scenario 1-to-1 | 空 ID、存在しない注文、確定済み注文 | `INVALID_ORDER_ID`, `ORDER_NOT_FOUND`, `INVALID_ORDER_STATE` | `SCN-ORD-002-02` | `tests/unit/application.test.mjs` |
| `UT-ORD-040` | `confirmOrder` 補償 | Scenario 1-to-1 | 在庫引当後の決済拒否 | `Err(PAYMENT_DECLINED)`、在庫解放、注文は `Draft` のまま | `SCN-ORD-002-03` | `tests/unit/application.test.mjs` |
| `UT-ORD-041` | `confirmOrder` 補償 | Scenario 1-to-1 | 決済成功後の保存失敗 | `Err(REPOSITORY_ERROR)`、決済返金 | `SCN-ORD-002-03` | `tests/unit/application.test.mjs` |
| `UT-ORD-042` | `confirmOrder` イベント発行 | Scenario 1-to-1 | パブリッシャ障害 | `Err(EVENT_PUBLISH_FAILED)` | `SCN-ORD-002-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-043` | `cancelOrder` | Scenario 1-to-1 | `Draft` と `Confirmed` 注文 | `Ok(Cancelled)`、確定済みは在庫解放と返金 | `SCN-ORD-003-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-044` | `cancelOrder` | Scenario 1-to-1 | 空 ID、存在しない注文、既にキャンセル済み | `INVALID_ORDER_ID`, `ORDER_NOT_FOUND`, `INVALID_ORDER_STATE` | `SCN-ORD-003-02` | `tests/unit/application.test.mjs` |
| `UT-ORD-045` | `cancelOrder` 補償 | Scenario 1-to-1 | 在庫解放または返金の失敗 | `Err(EXTERNAL_TIMEOUT)` | `SCN-ORD-003-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-046` | `confirmOrder` 補償 | Scenario 1-to-1 | 決済失敗後の在庫解放失敗 | `Err(EXTERNAL_TIMEOUT)` | `SCN-ORD-002-03` | `tests/unit/application.test.mjs` |
| `UT-ORD-047` | `placeOrder` イベント発行 | Scenario 1-to-1 | パブリッシャ障害 | `Err(EVENT_PUBLISH_FAILED)` | `SCN-ORD-001-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-048` | `confirmOrder` 補償 | Scenario 1-to-1 | 保存失敗後の返金失敗 | `Err(EXTERNAL_TIMEOUT)` | `SCN-ORD-002-03` | `tests/unit/application.test.mjs` |
| `UT-ORD-049` | `cancelOrder` 永続化 | Scenario 1-to-1 | 保存失敗 | `Err(REPOSITORY_ERROR)` | `SCN-ORD-003-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-050` | `cancelOrder` イベント発行 | Scenario 1-to-1 | パブリッシャ障害 | `Err(EVENT_PUBLISH_FAILED)` | `SCN-ORD-003-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-055` | `confirmOrder` 在庫不足 | Scenario 1-to-1 | 在庫引当失敗 | `Err(INSUFFICIENT_STOCK)` | `SCN-ORD-002-03` | `tests/unit/application.test.mjs` |
| `UT-ORD-056` | `cancelOrder` オーバーフロー | Scenario 1-to-1 | 合計がオーバーフローする確定済み注文 | `Err(INVALID_MONEY_AMOUNT)` | `SCN-ORD-003-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-057` | `getOrder` 読み取り障害 | Scenario 1-to-1 | リポジトリ読み取り失敗 | `Err(REPOSITORY_ERROR)` | `SCN-ORD-004-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-058` | `confirmOrder` 読み取り障害 | Scenario 1-to-1 | リポジトリ読み取り失敗 | `Err(REPOSITORY_ERROR)` | `SCN-ORD-002-03` | `tests/unit/application.test.mjs` |
| `UT-ORD-059` | `cancelOrder` 読み取り障害 | Scenario 1-to-1 | リポジトリ読み取り失敗 | `Err(REPOSITORY_ERROR)` | `SCN-ORD-003-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-060` | DTO モジュール | モジュール読込 | DTO モジュールの import | 実行時モジュールとして読み込まれる | `SCN-ORD-004-01` | `tests/unit/application.test.mjs` |
| `UT-ORD-064` | `confirmOrder` オーバーフロー | Scenario 1-to-1 | 合計がオーバーフローする注文 | `Err(INVALID_MONEY_AMOUNT)` | `SCN-ORD-002-03` | `tests/unit/application.test.mjs` |
