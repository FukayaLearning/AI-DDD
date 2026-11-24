# test-specification Spec Delta

## MODIFIED Requirements

### Requirement: Unit test specification per design element
単体テスト仕様書は、層・モジュールごとに設計要素（値オブジェクト、集約の不変条件と状態遷移、集約のカプセル化、Factory の生成/再構築分離、Entity の同一性、ドメインイベントのライフサイクル、マッパー、ゲートウェイのエラー変換、Presentation の分岐）を列挙し、各 `UT-` ケースについて試験設計技法・入力・期待結果・期待結果の根拠（対応する `REQ`/`SCN` または設計判断）を記載 MUST する。

#### Scenario: Unit test case documents its rationale
- **GIVEN** `Quantity` 値オブジェクト（1..100）
- **WHEN** 単体テスト仕様書を作成する
- **THEN** 境界値分析により 0・1・100・101 を入力とする `UT-` ケースが、期待結果と根拠となる要求 ID とともに記載される

## ADDED Requirements

### Requirement: Model integrity test cases
各リファレンス実装は、集約および値オブジェクトのカプセル化、Factory の新規生成と再構築の分離、Entity の同一性比較、値オブジェクトの自己検証、およびドメインイベントのライフサイクルを検証する `UT-` ケースを保持 MUST する。これらを欠く coverage-only のテストは違反として報告 MUST する。

#### Scenario: External mutation and forged value objects are rejected
- **GIVEN** 集約または値オブジェクトの不正な外部構築・書き換えを試みるテスト
- **WHEN** 単体テストを実行する
- **THEN** 言語の可視性・型・ファクトリ検証のいずれかにより拒否され、テストがその拒否を検証している

#### Scenario: Creation and reconstitution are tested separately
- **GIVEN** `Order` の新規生成 API と再構築 API
- **WHEN** 新規生成（`Draft`・`version = 0`・イベント空に固定）と、永続化状態（`Confirmed`/`Cancelled`・`version`）からの再構築および不変条件違反の再構築を試みる
- **THEN** 新規生成では遷移後状態の直接指定ができず、再構築では不変条件違反（不正な明細・負の `version` 等）が拒否され、整合する再構築のみが未発行イベント空で成功することをテストが検証している

#### Scenario: Domain-event lifecycle is verified
- **GIVEN** 確定または取消後の集約
- **WHEN** イベント発行経路または記録のみの方針を検証する
- **THEN** 発行経路では発行後のイベントクリアが、記録のみの方針では仕様・設計の宣言がテストまたは検証で確認されている

#### Scenario: Entity identity equality is verified
- **GIVEN** 同一 `OrderId` を持つが状態の異なる 2 つの `Order`
- **WHEN** 等価性を検証する
- **THEN** 同一性比較により等しいと判定され、全属性比較による不一致が発生しないことをテストが検証している
