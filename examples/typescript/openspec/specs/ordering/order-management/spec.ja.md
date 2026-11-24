<!-- ai-ddd-translation: source=spec.md sha256=cc3c210c8acabce2687a9470720ae43f5bfd7cc46efcdfdb66dc88832dd53d0e locale=ja -->

# ordering/order-management 仕様（日本語翻訳）

## Purpose
Ordering 境界づけられたコンテキストにおける顧客注文の完全なライフサイクルを管理し、注文の不変条件を強制し、在庫・決済を腐敗防止層経由で調整し、Web UI で注文ライフサイクルを描画する。

## Requirements

### Requirement: REQ-ORD-001 新規下書き注文を作成する
システムは、同一通貨・正の数量（1..100）・非負の単価を持つ 1〜5 件の重複しない `ProductId` の `OrderLine` から新しい `Draft` 注文を作成できなければならない（SHALL）。

#### Scenario: SCN-ORD-001-01 有効な下書き注文を作成する
- **GIVEN** 有効な `OrderId`、`CustomerId`、および同一通貨の 1〜5 件の重複しない `OrderLine`
- **WHEN** ユーザーが注文を作成する
- **THEN** システムは `Draft` 注文を永続化し合計金額を返す

#### Scenario: SCN-ORD-001-02 ドメイン不変条件に違反する注文を拒否する
- **GIVEN** 空の明細、6 件以上の明細、重複した `ProductId`、通貨不一致、または不正な `Quantity`/`Money`
- **WHEN** ユーザーが注文を作成する
- **THEN** システムはドメイン検証エラーでリクエストを拒否し、注文を保存しない

#### Scenario: SCN-ORD-001-03 永続化障害を返す
- **GIVEN** ストレージが利用できない状態での有効な注文リクエスト
- **WHEN** システムが注文を永続化しようとする
- **THEN** システムはユーザーに永続化障害を報告し、注文を保存しない

### Requirement: REQ-ORD-002 在庫引当と決済を伴う下書き注文の確定
システムは、在庫引当と決済捕捉が成功した場合にのみ `Draft` 注文を確定し、`OrderConfirmedEvent` を発行しなければならない（SHALL）。また、後続のステップが失敗した場合は外部副作用を補償しなければならない（SHALL）。

#### Scenario: SCN-ORD-002-01 下書き注文を正常に確定する
- **GIVEN** 既存の `Draft` 注文、利用可能な在庫、および承認される決済
- **WHEN** ユーザーが注文を確定する
- **THEN** 注文は `Confirmed` に遷移し、`OrderConfirmedEvent` が発行され、注文が保存される

#### Scenario: SCN-ORD-002-02 注文が存在しないか下書きでない場合に確定を失敗させる
- **GIVEN** 存在しない注文、または既に `Confirmed` もしくは `Cancelled` の注文
- **WHEN** ユーザーが注文を確定する
- **THEN** システムは確定を拒否し、注文を確定できない旨を報告する

#### Scenario: SCN-ORD-002-03 在庫不足・決済拒否・タイムアウト時に確定を失敗させる
- **GIVEN** 既存の `Draft` 注文と、在庫不足・決済拒否・外部タイムアウト
- **WHEN** ユーザーが注文を確定する
- **THEN** システムは障害を報告し、注文を `Draft` のまま維持し、既に行った在庫引当を解放する

### Requirement: REQ-ORD-003 注文をキャンセルする
システムは `Draft` または `Confirmed` 注文のキャンセルを許可し `OrderCancelledEvent` を発行しなければならず（SHALL）、確定済み注文では引当済み在庫と捕捉済み決済を補償しなければならない（SHALL）。既に `Cancelled` の注文のキャンセルは拒否しなければならない（SHALL）。

#### Scenario: SCN-ORD-003-01 下書きまたは確定済み注文をキャンセルする
- **GIVEN** 既存の `Draft` または `Confirmed` 注文
- **WHEN** ユーザーが注文をキャンセルする
- **THEN** 注文は `Cancelled` に遷移し、`OrderCancelledEvent` が発行され、注文が保存される

#### Scenario: SCN-ORD-003-02 既にキャンセル済みの注文のキャンセルを拒否する
- **GIVEN** 既存の `Cancelled` 注文
- **WHEN** ユーザーが再度注文をキャンセルする
- **THEN** システムはキャンセルを拒否し、既にキャンセル済みである旨を報告する

### Requirement: REQ-ORD-004 Web UI で注文を照会・操作する
システムは、注文の作成・閲覧・確定・キャンセルを行う Web UI ページを描画し、注文状態・操作の可否・ドメイン/システムエラーメッセージを反映しなければならない（SHALL）。

#### Scenario: SCN-ORD-004-01 ブラウザで注文ライフサイクルとエラーメッセージを描画する
- **GIVEN** アプリケーションユースケースを伴う Web UI
- **WHEN** ユーザーが 1〜5 明細の注文フォームを送信し、確定/キャンセルをクリックし、バリデーション/ドメインエラーを発生させ、または未知の注文にアクセスする
- **THEN** ブラウザは注文状態、合計金額、明細テーブル、状態に応じた操作ボタン、またはローカライズされたエラーメッセージを表示する
