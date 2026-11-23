# ddd-schema Spec Delta

## MODIFIED Requirements

### Requirement: Schema versioning
`ddd-driven` スキーマは互換性のない成果物グラフ・テンプレート変更のたびにバージョン番号を増分 SHALL し、本変更でバージョン `3` とする。`ai-ddd verify` はターゲットに配置されたスキーマのバージョンが CLI 同梱版より古い場合に警告 SHALL する。

#### Scenario: Outdated schema copy in a target project
- **GIVEN** スキーマ `version: 2` 以下が配置されたターゲットプロジェクト
- **WHEN** CLI 同梱スキーマが `version: 3` の `ai-ddd verify --target <dir>` を実行する
- **THEN** 古いスキーマバージョンと `ai-ddd install-schema` による更新方法が警告として出力される

### Requirement: Language, structure, and traceability conventions in templates
`ddd-driven` のテンプレートと `ddd-workflow` スキルは、英語マスター＋ユーザー言語翻訳の作成規約、4 層の戦術的パターン別×集約サブフォルダ細分化規約（`domain/{entities,value_objects,services,repositories,shared}`、`application/{services,ports,dtos}`、`infrastructure/{repositories,gateways,mappers,drivers}`、`presentation/{controllers,views,i18n}`）、および `REQ`/`SCN`/`UT`/`IT` の ID 記法を明示 SHALL する。

#### Scenario: Templates show identifier notation
- **GIVEN** `ddd-driven` スキーマで生成した `spec.md`、`design.md`、および `test-plan.md` のテンプレート
- **WHEN** テンプレートを参照する
- **THEN** `### Requirement: REQ-<CTX>-<NNN> ...`、`#### Scenario: SCN-<CTX>-<NNN>-<NN> ...`、`UT-<CTX>-<NNN>`、`IT-<CTX>-<NNN>` の記法例と、戦術的パターン別フォルダ構成規約が含まれる
