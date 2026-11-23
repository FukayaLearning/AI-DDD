# reference-examples Specification

## Purpose
Defines the four reference Ordering Bounded Context implementations under `examples/{typescript,python,go,rust}/` proving OpenSpec-to-DDD traceability, 100% C1 branch coverage outside exclusions, Mock-backed Chromium Web UI testing, and distribution integration testing.

## Requirements

### Requirement: Consistent Ordering domain model across all four languages
Each example under `examples/{typescript,python,go,rust}/` SHALL implement the Ordering Bounded Context using layer-first 4-layer DDD (`domain`, `application`, `infrastructure`, `presentation` plus `main` composition root), `Result<T, E>` error values, and OpenSpec `ddd-driven` artifacts.

#### Scenario: Domain invariants enforce business rules via Result
- **GIVEN** an `Order` aggregate with `OrderId`, `Money`, `Quantity`, and `OrderLine` value objects/entities
- **WHEN** creating an order with empty lines, >5 lines, duplicate product IDs, invalid quantity, or mismatched currency, or cancelling an already cancelled order
- **THEN** the domain returns an `Err(DomainError)` value without throwing domain exceptions

### Requirement: Three-part Infrastructure separation and C1 100% coverage
Each example SHALL split `infrastructure` into pure mappers/ACL converters, minimal branchless `drivers/`, and DI-injected repositories/gateways, achieving 100% C1 branch coverage across all non-excluded code.

#### Scenario: Repository and ACL error handling reach 100% C1 coverage via mock drivers
- **GIVEN** mock implementations of `KeyValueStorageDriver` and `HttpJsonDriver` injected into `DriverOrderRepository`, `InventoryGateway`, and `PaymentGateway`
- **WHEN** the unit test suite runs with C1 branch coverage verification excluding only `infrastructure/drivers/` and `main`
- **THEN** all storage, timeout, insufficient-stock, payment-declined, and mapping branches pass with 100% C1 branch coverage

### Requirement: Presentation Web UI verification via Mock and headless browser
Each example SHALL test its HTML SSR Web UI by launching the real HTTP presentation server with mocked Application UseCases, driving all normal and error flows in headless Chromium (Playwright/CDP), and asserting 100% C1 branch coverage in Presentation code.

#### Scenario: Browser renders normal and abnormal order workflows
- **GIVEN** the Presentation server running with mocked Order UseCases
- **WHEN** headless Chromium submits valid and invalid order creation, confirmation, and cancellation forms and visits non-existent order URLs
- **THEN** rendered DOM elements display the expected order state, totals, disabled/enabled action controls, and error banners, covering 100% of Presentation branches

### Requirement: Examples demonstrate module layout and traceability
各リファレンスサンプルは Ordering Bounded Context を戦術的パターン別×集約細分化構造（`domain/shared`・`domain/entities/order`・`domain/value_objects/{shared,order}`・`domain/repositories/order`・`application/{services,ports,dtos}/{order,shared}`・`infrastructure/repositories/order`・`infrastructure/gateways/{inventory,payment}`・`infrastructure/mappers/{order,inventory,payment}`・`infrastructure/drivers/{kv,http}`・`presentation/{controllers,views,i18n}`）で実装し、仕様見出し・試験仕様書・テスト名・ユースケース実装に ID を付与 SHALL する。`ai-ddd verify` と `ai-ddd trace --check` が成功 MUST する。

#### Scenario: Traceability matrix is complete for every example
- **GIVEN** `examples/{typescript,python,go,rust}/` の各サンプル
- **WHEN** `ai-ddd trace --target <example> --check` および `ai-ddd verify --target <example>` を実行する
- **THEN** 全 `REQ` と `SCN` に戦術的パターン別フォルダ配下の実装・単体テスト・結合テストが対応し、構造違反ゼロで終了コード 0 で終了する

### Requirement: Examples provide test specifications and abnormal-path integration tests
各サンプルは `docs/testing/integration/order-management.md` と層別の単体テスト仕様書を持ち、結合テストは正常系に加え、入力不正、不正状態遷移、在庫不足、決済拒否、外部サービスのタイムアウト・利用不可、永続化障害、対象未存在を配布形態の実行物に対して検証 SHALL する。

#### Scenario: Payment declined in integration test
- **GIVEN** 決済スタブが拒否応答を返すよう構成されたサンプルの結合テスト
- **WHEN** 下書き注文の確定を Web UI 経由で実行する
- **THEN** 応答画面に決済拒否のエラーが表示され、永続化された注文の状態が `Draft` のままであることが検証される

#### Scenario: Storage failure in integration test
- **GIVEN** 注文データ保存先が書き込み不可に構成されたサンプルの結合テスト
- **WHEN** 有効な注文を作成する
- **THEN** 応答画面に永続化エラーが表示され、注文データファイルが作成されないことが検証される

### Requirement: Examples demonstrate Japanese localization
各サンプルはユーザー言語 `ja` で構成され、変更・メイン仕様・`docs/domain/`・試験仕様書の日本語翻訳を持ち、Web UI を日本語で表示 SHALL する。ブラウザテストは `ja` と `en` の両ロケールで描画を検証 MUST する。

#### Scenario: Browser test verifies both locales
- **GIVEN** モック UseCase を注入して起動したサンプルの Web UI
- **WHEN** ヘッドレスブラウザで `ja` と `en` それぞれの設定で注文作成画面を表示する
- **THEN** 各ロケールのカタログ文言と HTML 言語属性が表示されることを検証する
