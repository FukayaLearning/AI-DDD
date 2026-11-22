<!-- ai-ddd-translation: source=order.md sha256=6e420c6f4952702afdb207dd3444f208eb947f35f50c4257d1b0a53fa895f625 locale=ja -->

# 単体試験仕様書 — application/order

| ID | 設計要素 | 試験技法 | 入力 | 期待結果 | 根拠 | 自動試験 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `UT-ORD-021` | `placeOrder` | シナリオ 1 対 1 | 有効な `PlaceOrderCommand` | 合計が算出された `Ok(Draft)` | `SCN-ORD-001-01` | `internal/*/*/*_test.go` |
| `UT-ORD-022` | `placeOrder` | シナリオ 1 対 1 | 不正な `orderId`・`customerId`・`productId`・`quantity`・`unitAmount`、または明細 0 件 | 保存を行わず対応する `DomainError` | `SCN-ORD-001-02` | `internal/*/*/*_test.go` |
| `UT-ORD-023` | `placeOrder` | シナリオ 1 対 1 | リポジトリが失敗する有効なコマンド | `Err(REPOSITORY_ERROR)` | `SCN-ORD-001-03` | `internal/*/*/*_test.go` |
| `UT-ORD-024` | `getOrder` | 同値分割 | 空 ID・存在しない ID・既存注文 ID | `INVALID_ORDER_ID`・`ORDER_NOT_FOUND`・`Ok(dto)` | `REQ-ORD-004` | `internal/*/*/*_test.go` |
| `UT-ORD-025` | `confirmOrder` | シナリオ 1 対 1 | 正常、未存在/非下書き、在庫不足、決済拒否、保存失敗 | 期待どおりの `Ok(Confirmed)` または型付き `DomainError` | `SCN-ORD-002-01`, `SCN-ORD-002-02`, `SCN-ORD-002-03` | `internal/*/*/*_test.go` |
| `UT-ORD-026` | `cancelOrder` | シナリオ 1 対 1 | 正常、未存在、保存失敗、取消済み | `Ok(Cancelled)` または型付き `DomainError` | `SCN-ORD-003-01`, `SCN-ORD-003-02` | `internal/*/*/*_test.go` |
