<!-- ai-ddd-translation: source=order_web.md sha256=7e27c41245b647515cda18825f6c55782ebfd5f04e4dcc6324562c376c2985c8 locale=ja -->

# 単体テスト仕様 — presentation/controllers/order, presentation/views/order, presentation/i18n

| ID | 設計要素 | 技法 | 入力 | 期待結果 | 根拠 | 自動テスト |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `UT-ORD-027` | 注文作成フォーム | ヘッドレスブラウザ分岐 | 不正送信と有効送信 | 422 でエラーメッセージ、200 で合計付き `Draft` 画面 | `SCN-ORD-004-01` | `tests/unit/presentation.browser.test.mjs` |
| `UT-ORD-028` | 確定操作 | ヘッドレスブラウザ分岐 | `INSUFFICIENT_STOCK` 後に `Ok(Confirmed)` | エラーメッセージ、その後 `Confirmed` と確定ボタン無効化 | `SCN-ORD-004-01` | `tests/unit/presentation.browser.test.mjs` |
| `UT-ORD-029` | キャンセル操作 | ヘッドレスブラウザ分岐 | `REPOSITORY_ERROR` 後に `Ok(Cancelled)` | エラーメッセージ、その後 `Cancelled` と両ボタン無効化 | `SCN-ORD-004-01` | `tests/unit/presentation.browser.test.mjs` |
| `UT-ORD-030` | 詳細・404 ルート | ヘッドレスブラウザ・HTTP 分岐 | 既存注文 GET、未知注文 GET、未知ルート GET、未知 POST/PUT | 注文詳細 DOM、`ORDER_NOT_FOUND` メッセージ、404 画面 | `SCN-ORD-004-01` | `tests/unit/presentation.browser.test.mjs` |
| `UT-ORD-031` | ローカライズ UI | ヘッドレスブラウザ分岐 | `ja` と `en` のメッセージカタログ | ローカライズされた見出し・ボタンと `<html lang>` の一致 | `SCN-ORD-004-01` | `tests/unit/presentation.browser.test.mjs` |
| `UT-ORD-051` | 複数明細フォーム | ヘッドレスブラウザ分岐 | 明細追加ボタンと 2 明細の入力 | 詳細画面に両明細が表示される | `SCN-ORD-004-01` | `tests/unit/presentation.browser.test.mjs` |
