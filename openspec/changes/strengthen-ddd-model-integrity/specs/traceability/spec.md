# traceability Spec Delta

## MODIFIED Requirements

### Requirement: Traceability gap detection
`ai-ddd trace --check` は次の場合に終了コード 1 で失敗 MUST する: 結合テストケースのない Scenario、`@implements` のない Requirement、テストコードの存在しない試験ケース、存在しない ID を参照する試験ケース・テスト・注記、および Scenario と Application 層 UseCase テストの 1-to-1 対応の欠落。`ai-ddd verify` はこの検査を含め MUST する。

#### Scenario: Scenario without an integration test case
- **GIVEN** `SCN-ORD-003-02` を参照する `IT-` ケースが試験仕様書に存在しない
- **WHEN** `ai-ddd trace --target <dir> --check` を実行する
- **THEN** コマンドは終了コード 1 で失敗し、未カバーの `SCN-ORD-003-02` を報告する

#### Scenario: Orphan reference in tests
- **GIVEN** テストコードが試験仕様書に存在しない `UT-ORD-099` を参照している
- **WHEN** `ai-ddd verify --target <dir>` を実行する
- **THEN** コマンドは終了コード 1 で失敗し、孤立参照のファイルと ID を報告する

#### Scenario: Scenario lacks a one-to-one UseCase test
- **GIVEN** `SCN-ORD-001-02` に対応する Application 層の UseCase テストが存在しない、または 1 つの `UT-` ケースが複数の Scenario を明示的な対応表なしにまとめて検証している
- **WHEN** `ai-ddd trace --target <dir> --check` を実行する
- **THEN** コマンドは終了コード 1 で失敗し、1-to-1 対応が欠けている Scenario と `UT-` ケースを報告する
