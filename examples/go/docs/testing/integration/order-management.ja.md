<!-- ai-ddd-translation: source=order-management.md sha256=88e9777b4c268521daf8a7e4c873b11595286ceb791db532950e69d33f2ef9aa locale=ja -->

# 結合試験仕様書 — ordering/order-management

## 試験ケース

| ID | タイトル | 対応 (SCN) | 試験技法 | 前提条件 (GIVEN) | 操作手順 (WHEN) | 期待結果 (THEN) | 優先度 | 自動試験 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `IT-ORD-001` | 注文ライフサイクル全体（Draft -> Confirmed -> Cancelled） | `SCN-ORD-001-01`, `SCN-ORD-002-01`, `SCN-ORD-003-01`, `SCN-ORD-004-01` | シナリオ E2E | 書き込み可能なデータディレクトリと 200 OK の外部スタブで実サーバーを起動 | POST `/orders`、POST `/orders/{id}/confirm`、POST `/orders/{id}/cancel` | 状態が `Draft` -> `Confirmed` -> `Cancelled` と遷移し、合計が表示され、JSON が永続化される | P1 | `scripts/test-integration.sh` |
| `IT-ORD-002` | E2E で不正な注文入力を拒否する | `SCN-ORD-001-02` | 境界値 | 実サーバーを起動 | `quantity=0` で POST `/orders` | HTTP 422 で `INVALID_QUANTITY` のエラーバナーを返し、ファイルは永続化されない | P1 | `scripts/test-integration.sh` |
| `IT-ORD-003` | 不正な状態遷移を拒否する | `SCN-ORD-002-02`, `SCN-ORD-003-02` | 状態遷移 | 取消済み注文が永続化済み | POST `/orders/{id}/confirm` と `/orders/{id}/cancel` | HTTP 422 で `INVALID_ORDER_STATE` | P1 | `scripts/test-integration.sh` |
| `IT-ORD-004` | 在庫不足時に承認が失敗する | `SCN-ORD-002-03` | エラー推測 | `Draft` 注文が永続化済み、在庫スタブが 409 を返す | POST `/orders/{id}/confirm` | HTTP 422 で `INSUFFICIENT_STOCK`、永続化された注文は `Draft` のまま | P1 | `scripts/test-integration.sh` |
| `IT-ORD-005` | 決済拒否時に承認が失敗する | `SCN-ORD-002-03` | エラー推測 | `Draft` 注文が永続化済み、在庫スタブ 200・決済スタブ 402 | POST `/orders/{id}/confirm` | HTTP 422 で `PAYMENT_DECLINED`、永続化された注文は `Draft` のまま | P1 | `scripts/test-integration.sh` |
| `IT-ORD-006` | 外部タイムアウト時に承認が失敗する | `SCN-ORD-002-03` | エラー推測 | `Draft` 注文が永続化済み、決済スタブが `HTTP_TIMEOUT_MS` を超えて遅延 | POST `/orders/{id}/confirm` | HTTP 422 で `EXTERNAL_TIMEOUT`、永続化された注文は `Draft` のまま | P2 | `scripts/test-integration.sh` |
| `IT-ORD-007` | 外部サービス利用不可時に承認が失敗する | `SCN-ORD-002-03` | エラー推測 | `Draft` 注文が永続化済み、在庫 URL が閉じたポートを指す | POST `/orders/{id}/confirm` | HTTP 422 で `EXTERNAL_TIMEOUT`、永続化された注文は `Draft` のまま | P2 | `scripts/test-integration.sh` |
| `IT-ORD-008` | 永続化障害時に注文作成が失敗する | `SCN-ORD-001-03` | 障害注入 | 読み取り専用のデータディレクトリでサーバーを構成 | 有効なペイロードで POST `/orders` | HTTP 422 で `REPOSITORY_ERROR` を返し、注文ファイルは作成されない | P1 | `scripts/test-integration.sh` |
| `IT-ORD-009` | 未存在注文の取得は 404 を返す | `SCN-ORD-002-02`, `SCN-ORD-004-01` | 同値分割 | 実サーバーを起動 | GET `/orders/NO-SUCH` | HTTP 404 で `ORDER_NOT_FOUND` | P2 | `scripts/test-integration.sh` |
| `IT-ORD-010` | ロケール別 Web UI 表示（`ja` と `en`） | `SCN-ORD-004-01` | 同値分割 | 既定の `ja` と `APP_LOCALE=en` でサーバーを起動 | 各サーバーで GET `/` | `<html lang="ja">` と日本語ラベル、対して `<html lang="en">` と英語ラベル | P2 | `scripts/test-integration.sh` |

## 異常系導出チェックリスト

| カテゴリ | ケース ID | 非該当理由 |
| :--- | :--- | :--- |
| 入力値の境界・不正値 | `IT-ORD-002` | |
| 不正な状態遷移 | `IT-ORD-003` | |
| 外部依存の障害（タイムアウト・拒否・利用不可） | `IT-ORD-004`, `IT-ORD-005`, `IT-ORD-006`, `IT-ORD-007` | |
| 永続化・ストレージ障害 | `IT-ORD-008` | |
| 重複・競合操作 | | 単一プロセスのローカル KV ファイル保存であり、複数ライターの同時ロックを行わない |
| 対象未存在 | `IT-ORD-009` | |
| ロケール別表示 | `IT-ORD-010` | |
