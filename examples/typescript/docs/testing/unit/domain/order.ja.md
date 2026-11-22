<!-- ai-ddd-translation: source=order.md sha256=d7ba911366342689dd310588946c6936a7f5218a9576b7af7b70cf978f267fa1 locale=ja -->

# 単体試験仕様書 — domain/order

| ID | 設計要素 | 試験技法 | 入力 | 期待結果 | 根拠 | 自動試験 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `UT-ORD-001` | `OrderId` | 同値分割 | 空白文字列 / 前後空白付き文字列 | `Err(INVALID_ORDER_ID)` / `Ok` | `REQ-ORD-001` | `tests/unit/domain.test.mjs` |
| `UT-ORD-002` | `CustomerId` | 同値分割 | 空文字列 / 前後空白付き文字列 | `Err(INVALID_CUSTOMER_ID)` / `Ok` | `REQ-ORD-001` | `tests/unit/domain.test.mjs` |
| `UT-ORD-003` | `ProductId` | 同値分割 | 空文字列 / 前後空白付き文字列 | `Err(INVALID_PRODUCT_ID)` / `Ok` | `REQ-ORD-001` | `tests/unit/domain.test.mjs` |
| `UT-ORD-004` | `Quantity` | 境界値分析 | `0`, `1`, `100`, `101`, `1.5` | `1..100` の整数は `Ok`、それ以外は `Err(INVALID_QUANTITY)` | `REQ-ORD-001` | `tests/unit/domain.test.mjs` |
| `UT-ORD-005` | `Money` | 境界値分析 | `-1`, `10.5`, `0 JPY`, `500 JPY`, `5 USD` | 負値・小数は `Err(INVALID_MONEY_AMOUNT)`、それ以外は `Ok` | `REQ-ORD-001` | `tests/unit/domain.test.mjs` |
| `UT-ORD-006` | `Money` 演算 | 同値分割 | `multiplyMoney`、`addMoney` の同一通貨・異通貨 | 正しい積・和、または `Err(CURRENCY_MISMATCH)` | `REQ-ORD-001` | `tests/unit/domain.test.mjs` |
| `UT-ORD-007` | `Order.create`（明細 0 件） | 境界値分析 | 空の明細配列 `[]` | `Err(EMPTY_ORDER_LINES)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-008` | `Order.create`（明細 6 件） | 境界値分析 | 重複のない明細 6 件 | `Err(TOO_MANY_ORDER_LINES)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-009` | `Order.create`（重複） | エラー推測 | 同一 `ProductId` を持つ明細 2 件 | `Err(DUPLICATE_PRODUCT)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-010` | `Order.create`（通貨） | エラー推測 | `JPY` と `USD` が混在する明細 | `Err(CURRENCY_MISMATCH)` | `SCN-ORD-001-02` | `tests/unit/domain.test.mjs` |
| `UT-ORD-011` | `Order.create`（正常） | 同値分割 | 有効な明細 1〜5 件 | `Ok(Draft)` かつ `totalAmount()` が正確 | `SCN-ORD-001-01` | `tests/unit/domain.test.mjs` |
| `UT-ORD-012` | `Order.confirm` | 状態遷移 | `Draft` -> `Confirmed` -> `confirm()` | `Confirmed` と `OrderConfirmedEvent`、2 回目の confirm は `INVALID_ORDER_STATE` | `REQ-ORD-002` | `tests/unit/domain.test.mjs` |
| `UT-ORD-013` | `Order.cancel` | 状態遷移 | `Confirmed` -> `Cancelled` -> `cancel()` | `Cancelled` と `OrderCancelledEvent`、2 回目の cancel は `INVALID_ORDER_STATE` | `REQ-ORD-003` | `tests/unit/domain.test.mjs` |
