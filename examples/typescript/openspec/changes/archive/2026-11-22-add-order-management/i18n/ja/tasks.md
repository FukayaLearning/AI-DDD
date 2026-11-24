<!-- ai-ddd-translation: source=../../tasks.md sha256=ec5a0165b74f67569e5acd6aaa731e9db373dac2975063a9963b30eb0c068648 locale=ja -->

# タスク

## 1. 戦略文書とドメイン層 TDD（100% C1）

- [x] 1.1 `docs/domain/ubiquitous-language.md` と `context-map.md` を同期し、コアドメイン/汎用サブドメイン/共有カーネルの決定を記録する
- [x] 1.2 カプセル化された値オブジェクト、`Order.create`/`reconstitute`、同一性、イベント pull/clear、`Result` の合計、エラー型分離、`version` を実装し、単体テストを 100% C1 にする

## 2. インフラ層 3 分割 TDD（`drivers/` 以外 100% C1）

- [x] 2.1 純粋な `OrderMapper`（イベント非永続化）と単体テストを 100% C1 にする
- [x] 2.2 分岐なし `KvDriver` と `HttpJsonDriver` を `src/infrastructure/drivers/` に実装する
- [x] 2.3 `DriverOrderRepository`（version 競合）、`InventoryGateway` / `PaymentGateway`（引当/解放、決済/返金）、`LoggingEventPublisher`、モックドライバ異常系テストを 100% C1 にする

## 3. アプリケーション層シナリオ TDD（100% C1）

- [x] 3.1 `OrderApplicationService`、保存後の `DomainEventPublisher` 発行、補償、遷移後集約の使用、1-to-1 シナリオテストを 100% C1 にする

## 4. プレゼンテーション層 Mock × Chromium TDD（100% C1）

- [x] 4.1 `canConfirm`/`canCancel`、安全な入力解析、1〜5 明細フォームを備えた Web UI とブラウザテストを 100% C1 にする

## 5. ガバナンスと結合検証

- [x] 5.1 `ai-ddd verify`、`ai-ddd trace --check`、C1 100% スイート、バイナリ結合テストを実行する
