<!-- ai-ddd-translation: source=order.md sha256=2623344f17f2c2dbdf50c12340e8703ec7e1f3eeb8d96b43fb746a955270b8d5 locale=ja -->

# 単体テスト仕様 — domain/entities/order, domain/value_objects/shared, domain/value_objects/order

| ID | 設計要素 | 技法 | 入力 | 期待結果 | 根拠 | 自動テスト |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `UT-ORD-001` | `OrderId` | 同値分割 | 空白文字列 / トリム済み文字列 | `Err(INVALID_ORDER_ID)` / `Ok` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-002` | `CustomerId` | 同値分割 | 空文字列 / トリム済み文字列 | `Err(INVALID_CUSTOMER_ID)` / `Ok` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-003` | `ProductId` | 同値分割 | 空文字列 / トリム済み文字列 | `Err(INVALID_PRODUCT_ID)` / `Ok` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-004` | `Quantity` | 境界値分析 | `0`, `1`, `100`, `101`, `1.5` | `1..100` の整数で `Ok`、それ以外は `Err(INVALID_QUANTITY)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-005` | `Money` | 境界値分析 | `-1`, `10.5`, `0 JPY`, `500 JPY`, `5 USD`, `5 EUR` | 負数・小数・未対応通貨で `Err`、それ以外は `Ok` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-006` | `Money` 演算 | 同値分割 | `multiplyMoney`, `addMoney` の同一・異種通貨 | 正しい積・和、または `Err(CURRENCY_MISMATCH)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-007` | `Order.create`（0 明細） | 境界値分析 | 空の明細配列 `[]` | `Err(EMPTY_ORDER_LINES)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-008` | `Order.create`（6 明細） | 境界値分析 | 重複しない 6 明細 | `Err(TOO_MANY_ORDER_LINES)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-009` | `Order.create`（重複） | エラー推測 | 同一 `ProductId` の 2 明細 | `Err(DUPLICATE_PRODUCT)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-010` | `Order.create`（通貨） | エラー推測 | `JPY` と `USD` の混在 | `Err(CURRENCY_MISMATCH)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-011` | `Order.create`（正常） | 同値分割 | 有効な 1..5 明細 | `Ok(Draft)` と正確な `totalAmount()` | `SCN-ORD-001-01` | `tests/unit/domain.test.mjs` |
| `UT-ORD-012` | `Order.confirm` | 状態遷移 | `Draft` -> `Confirmed` -> `confirm()` | `Confirmed` + `OrderConfirmedEvent`、2 回目は `INVALID_ORDER_STATE` | `SCN-ORD-002-01` | `tests/unit/domain.test.mjs` |
| `UT-ORD-013` | `Order.cancel` | 状態遷移 | `Confirmed` -> `Cancelled` -> `cancel()` | `Cancelled` + `OrderCancelledEvent`、2 回目は `INVALID_ORDER_STATE` | `SCN-ORD-003-01` | `tests/unit/domain.test.mjs` |
| `UT-ORD-032` | 値オブジェクト構築 | エラー推測 | ID・`Quantity`・`Money` の不正な直接構築 | 不正値が流通する前にコンストラクタが例外を投げる | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-033` | Factory 分離 | 同値分割 | `Order.create` と `Order.reconstitute`、不正な version/status | 新規生成は常に `Draft`/version 0、再構築は不変条件を検証 | `SCN-ORD-001-01` | `tests/unit/domain.test.mjs` |
| `UT-ORD-034` | Entity 同一性 | 同値分割 | 同一 `OrderId` で状態違い / 異なる `OrderId` | `OrderId` のみで等価判定 | `SCN-ORD-001-01` | `tests/unit/domain.test.mjs` |
| `UT-ORD-035` | イベントライフサイクル | 状態遷移 | `pullEvents()` の 2 回呼び出しと `clearEvents()` | イベントは 1 回だけ引き出され、クリアされる | `SCN-ORD-002-01` | `tests/unit/domain.test.mjs` |
| `UT-ORD-036` | 遷移可否判定 | 状態遷移 | 各状態での `canConfirm()` / `canCancel()` | 正しい真偽値 | `SCN-ORD-002-01` | `tests/unit/domain.test.mjs` |
| `UT-ORD-037` | 偽造 `OrderLine` | エラー推測 | 値オブジェクトの代わりにオブジェクトリテラル | `Err(INVALID_PRODUCT_ID)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-038` | Money オーバーフロー | 境界値分析 | `MAX_SAFE_INTEGER` の加算・乗算 | `Err(INVALID_MONEY_AMOUNT)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-039` | 偽造 Quantity/Money | エラー推測 | `Quantity` と `Money` のオブジェクトリテラル | `Err(INVALID_QUANTITY)` / `Err(INVALID_MONEY_AMOUNT)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-052` | `totalAmount` オーバーフロー | 境界値分析 | 和がオーバーフローする 2 明細 | `Err(INVALID_MONEY_AMOUNT)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-053` | 値オブジェクト等価性 | 同値分割 | 等しい・等しくない値オブジェクト | 属性値による等価判定 | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-054` | `createMoney` ファクトリ | 同値分割 | 有効・負の金額 | `Ok` / `Err(INVALID_MONEY_AMOUNT)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-063` | 合計オーバーフローでの確定 | 境界値分析 | 合計がオーバーフローする注文の確定 | `Err(INVALID_MONEY_AMOUNT)` | `SCN-ORD-002-01` | `tests/unit/domain.test.mjs` |
