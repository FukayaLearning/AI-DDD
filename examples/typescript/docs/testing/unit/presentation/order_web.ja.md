<!-- ai-ddd-translation: source=order_web.md sha256=95594a9ea04ee3aff7759e9fb1eddf787e28c95264b6c3efe44f187ed6d686b2 locale=ja -->

# 単体試験仕様書 — presentation/web/order

| ID | 設計要素 | 試験技法 | 入力 | 期待結果 | 根拠 | 自動試験 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `UT-ORD-027` | 注文作成フォーム | ヘッドレスブラウザー分岐 | 不正なフォーム送信と有効なフォーム送信 | 422 ではエラーバナー、200 では合計付きの `Draft` 注文表示 | `SCN-ORD-004-01` | `tests/unit/presentation.browser.test.mjs` |
| `UT-ORD-028` | 承認操作 | ヘッドレスブラウザー分岐 | `confirmOrder` のモックが `INSUFFICIENT_STOCK` を返した後に `Ok(Confirmed)` | エラーバナー、その後 `Confirmed` 状態と承認ボタンの無効化 | `SCN-ORD-004-01` | `tests/unit/presentation.browser.test.mjs` |
| `UT-ORD-029` | 取消操作 | ヘッドレスブラウザー分岐 | `cancelOrder` のモックが `REPOSITORY_ERROR` を返した後に `Ok(Cancelled)` | エラーバナー、その後 `Cancelled` 状態と両操作ボタンの無効化 | `SCN-ORD-004-01` | `tests/unit/presentation.browser.test.mjs` |
| `UT-ORD-030` | 詳細・404 ルート | ヘッドレスブラウザー・HTTP 分岐 | 既存注文 GET、未存在注文 GET、未定義ルート GET、未定義 POST/PUT | 注文詳細 DOM、`ORDER_NOT_FOUND` バナー、404 の Not Found 表示 | `SCN-ORD-004-01` | `tests/unit/presentation.browser.test.mjs` |
| `UT-ORD-031` | ロケール別 UI カタログ | ヘッドレスブラウザー分岐 | `ja` と `en` のメッセージカタログで起動したサーバー | ロケール別の見出し・ボタンと一致する `<html lang>` | `REQ-ORD-004` | `tests/unit/presentation.browser.test.mjs` |
