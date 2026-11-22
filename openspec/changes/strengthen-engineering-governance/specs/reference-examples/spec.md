# Spec Delta

## ADDED Requirements

### Requirement: Examples demonstrate module layout and traceability
各リファレンスサンプルは Ordering Bounded Context をモジュール細分化構造（`domain/shared`・`domain/order`・`application/order/commands|queries`・`infrastructure/drivers|persistence|acl`・`presentation/web/order`）で実装し、仕様見出し・試験仕様書・テスト名・ユースケース実装に ID を付与 SHALL する。`ai-ddd verify` と `ai-ddd trace --check` が成功 MUST する。

#### Scenario: Traceability matrix is complete for every example
- **GIVEN** `examples/{typescript,python,go,rust}/` の各サンプル
- **WHEN** `ai-ddd trace --target <example> --check` を実行する
- **THEN** 全 `REQ` と `SCN` に実装・単体テスト・結合テストが対応し、終了コード 0 で終了する

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
