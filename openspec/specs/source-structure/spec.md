# source-structure Specification

## Purpose
DDD の Layer-first 4 層構造を維持したまま、各層内部を集約・ユースケース・外部コンテキスト・技術単位のモジュールに細分化し、ファイル数が増えても構造が保たれることを静的に検証する。

## Requirements

### Requirement: Module-subdivided layer layout
`ai-ddd init` が生成するスケルトンおよびリファレンスサンプルは、4 層それぞれの内部を「第 2 階層＝DDD の戦術的パターン／役割フォルダ」「第 3 階層＝集約・外部コンテキスト・技術・リソース単位のモジュールフォルダ」の 3 階層構造に分割 SHALL する:
- `domain` 層は `domain/shared/`（`Result<T, E>`・`DomainError` 等の基底のみ）および `domain/{entities,value_objects,services,repositories}/<aggregate>/`（他集約からも参照される識別子 ID や共通値オブジェクトは `domain/value_objects/shared/`）に分割する。
- `application` 層は `application/{services,ports,dtos}/<aggregate|shared>/` に分割する。
- `infrastructure` 層は `infrastructure/repositories/<aggregate>/`・`infrastructure/gateways/<external-context>/`・`infrastructure/mappers/<aggregate|external-context>/`・`infrastructure/drivers/<technology>/` に分割する。
- `presentation` 層は `presentation/{controllers,views,i18n}/<resource|shared>/`（または `presentation/i18n/` 直下のロケールファイル）に分割する。

#### Scenario: Generated skeleton follows module layout
- **GIVEN** 任意の言語・配布形態の組み合わせ
- **WHEN** `ai-ddd init ... --yes` を実行する
- **THEN** 生成されたソースは `domain/shared/`・`domain/entities/<aggregate>/`・`domain/value_objects/{shared,<aggregate>}/`・`domain/repositories/<aggregate>/`・`application/{services,ports,dtos}/<aggregate|shared>/`・`infrastructure/repositories/<aggregate>/`・`infrastructure/gateways/<external-context>/`・`infrastructure/mappers/<aggregate|external-context>/`・`infrastructure/drivers/<technology>/`・`presentation/{controllers,views,i18n}/` に配置され、`ai-ddd verify` が成功する

### Requirement: No loose files at layer roots
`ai-ddd verify` は、`domain`・`application`・`infrastructure`・`presentation` の各層ルート直下、および各パターンフォルダ（`domain/shared` と `presentation/i18n` を除く第 2 階層フォルダ）の直下に置かれたソースファイル（言語のモジュール宣言ファイルを除く）を構造違反として報告 MUST する。

#### Scenario: File placed directly under a layer root
- **GIVEN** `domain` 層ルート直下に集約の実装ファイルが置かれている
- **WHEN** `ai-ddd verify --target <dir>` を実行する
- **THEN** コマンドは終了コード 1 で失敗し、該当ファイルと配置すべき戦術的パターンフォルダ種別を報告する

#### Scenario: File placed directly under a tactical pattern folder without aggregate subfolder
- **GIVEN** `domain/entities/order.ts` のように集約サブフォルダ（`domain/entities/order/`）を介さずパターンフォルダ直下にソースファイルが置かれている
- **WHEN** `ai-ddd verify --target <dir>` を実行する
- **THEN** コマンドは終了コード 1 で失敗し、該当ファイルを集約／モジュールサブフォルダ配下に配置すべき旨を報告する

### Requirement: Aggregate module isolation
`domain` 層の各戦術的パターンフォルダ配下の集約サブフォルダ（`domain/{entities,value_objects,services,repositories}/<aggregate>/`）は、同一集約 `<aggregate>` のモジュール、`domain/shared/`、および `domain/value_objects/shared/` のみに依存 MUST し、`ai-ddd verify` は他の集約サブフォルダ（`domain/<pattern>/<other-aggregate>/`）への直接依存を違反として報告 MUST する。集約間の参照は識別子の値オブジェクトを `domain/value_objects/shared/` に置いて行う。

#### Scenario: Aggregate imports another aggregate
- **GIVEN** `domain/entities/order/` 内のファイルが `domain/entities/customer/` または `domain/value_objects/customer/` のファイルを参照している
- **WHEN** `ai-ddd verify --target <dir>` を実行する
- **THEN** コマンドは終了コード 1 で失敗し、参照元・参照先集約モジュールを報告する

### Requirement: Strict tactical pattern folder whitelist per layer
`ai-ddd verify` は、各層の第 2 階層ディレクトリ名を次の許可リストで厳格に検証 MUST する:
- `domain`: `entities`, `value_objects`, `services`, `repositories`, `shared`
- `application`: `services`, `ports`, `dtos`
- `infrastructure`: `repositories`, `gateways`, `mappers`, `drivers`
- `presentation`: `controllers`, `views`, `i18n`
許可リストに含まれない第 2 階層フォルダが検出された場合、`ai-ddd verify` は構造違反として終了コード 1 で失敗 MUST する。

#### Scenario: Unauthorized subfolder under a layer is rejected
- **GIVEN** `domain/helpers/order/util.ts` または `infrastructure/utils/db/helper.ts` のように許可リスト外の第 2 階層フォルダが存在する
- **WHEN** `ai-ddd verify --target <dir>` を実行する
- **THEN** コマンドは終了コード 1 で失敗し、不正なフォルダ名とその層で許可されているパターンフォルダ一覧を報告する

### Requirement: Directory size warning
`ai-ddd verify` は、1 ディレクトリ直下のソースファイル数がプロジェクト設定の閾値（既定 15）を超えた場合に、さらなる細分化を促す警告を出力 SHALL する。警告のみでは終了コードを失敗にしない。

#### Scenario: Module grows beyond the threshold
- **GIVEN** `application/order/commands/` に 16 個のソースファイルがある
- **WHEN** `ai-ddd verify --target <dir>` を実行する
- **THEN** 警告としてディレクトリ名とファイル数が出力され、他に違反がなければ終了コード 0 で終了する
