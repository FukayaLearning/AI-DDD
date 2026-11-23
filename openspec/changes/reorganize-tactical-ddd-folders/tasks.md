# Tasks

## 1. スキーマ・テンプレート・スキルの戦術的パターン別フォルダ構成への更新

- [ ] 1.1 `schemas/ddd-driven/schema.yaml`（`version: 3` へ更新）および `schemas/ddd-driven/templates/{design,tasks,test-plan}.md`、`skills/ddd-workflow/SKILL.md`（および配布先スキルコピー）の 4 層フォルダ構成規約を `domain/{entities,value_objects,services,repositories,shared}`・`application/{services,ports,dtos}`・`infrastructure/{repositories,gateways,mappers,drivers}`・`presentation/{controllers,views,i18n}` に更新し、`openspec schema validate ddd-driven` が成功することを確認する

## 2. `ai-ddd verify` 静的構造検証と単体テストの更新

- [ ] 2.1 `src/verifier.js` および `src/i18n.js` を更新し、各層の第 2 階層パターンフォルダのホワイトリスト検証、第 1・第 2 階層直下ファイル禁止検証、およびパターンフォルダ横断の集約間直接依存禁止検証（`domain/<pattern>/<aggregate>/`）を実装し、`tests/` の verifier 単体テストを追加・更新して通過することを確認する

## 3. 4 言語スケルトン生成器（`src/skeletons/*.js`）の更新

- [ ] 3.1 `src/skeletons/{typescript,python,go,rust,common_docs}.js` を新 3 階層フォルダ構成（`Layer -> Tactical Pattern -> Aggregate/Module`）に更新し、`ai-ddd init` の生成物に対して `ai-ddd verify` および `ai-ddd trace --check` が通過することをテストで確認する

## 4. 4 言語リファレンス実装（`examples/*`）の新フォルダ構成への移行と検証

- [ ] 4.1 `examples/typescript/` を新フォルダ構成へ移行し、設計書・テスト仕様書・翻訳スタンプ・トレーサビリティマトリクスを更新の上、`ai-ddd verify --target examples/typescript` および単体/C1テストが通過することを確認する
- [ ] 4.2 `examples/python/` を新フォルダ構成へ移行し、設計書・テスト仕様書・翻訳スタンプ・トレーサビリティマトリクスを更新の上、`ai-ddd verify --target examples/python` および単体/C1テストが通過することを確認する
- [ ] 4.3 `examples/go/` を新フォルダ構成へ移行し、設計書・テスト仕様書・翻訳スタンプ・トレーサビリティマトリクスを更新の上、`ai-ddd verify --target examples/go` および単体/C1テストが通過することを確認する
- [ ] 4.4 `examples/rust/` を新フォルダ構成へ移行し、設計書・テスト仕様書・翻訳スタンプ・トレーサビリティマトリクスを更新の上、`ai-ddd verify --target examples/rust` および単体/C1テストが通過することを確認する
- [ ] 4.5 `npm run verify:examples` および `npm test` を実行し、全スイートがエラー・ドリフトなしで通過することを確認する
