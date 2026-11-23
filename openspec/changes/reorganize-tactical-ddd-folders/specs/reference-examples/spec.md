# reference-examples Spec Delta

## MODIFIED Requirements

### Requirement: Examples demonstrate module layout and traceability
各リファレンスサンプルは Ordering Bounded Context を戦術的パターン別×集約細分化構造（`domain/shared`・`domain/entities/order`・`domain/value_objects/{shared,order}`・`domain/repositories/order`・`application/{services,ports,dtos}/{order,shared}`・`infrastructure/repositories/order`・`infrastructure/gateways/{inventory,payment}`・`infrastructure/mappers/{order,inventory,payment}`・`infrastructure/drivers/{kv,http}`・`presentation/{controllers,views,i18n}`）で実装し、仕様見出し・試験仕様書・テスト名・ユースケース実装に ID を付与 SHALL する。`ai-ddd verify` と `ai-ddd trace --check` が成功 MUST する。

#### Scenario: Traceability matrix is complete for every example
- **GIVEN** `examples/{typescript,python,go,rust}/` の各サンプル
- **WHEN** `ai-ddd trace --target <example> --check` および `ai-ddd verify --target <example>` を実行する
- **THEN** 全 `REQ` と `SCN` に戦術的パターン別フォルダ配下の実装・単体テスト・結合テストが対応し、構造違反ゼロで終了コード 0 で終了する
