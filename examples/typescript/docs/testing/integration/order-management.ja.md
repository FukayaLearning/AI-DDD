<!-- ai-ddd-translation: source=order-management.md sha256=a07d7dda54bbebd65d5bd4cc63f41d14bf7185cfc2cfe55005194c02dba77faa locale=ja -->

# 結合テスト仕様 — ordering/order-management

## テストケース

| ID | タイトル | 対応 (SCN) | 技法 | 前提条件 (GIVEN) | 手順 (WHEN) | 期待結果 (THEN) | 優先度 | 自動テスト |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `IT-ORD-001` | 注文ライフサイクル全体（Draft -> Confirmed -> Cancelled） | `SCN-ORD-001-01`, `SCN-ORD-002-01`, `SCN-ORD-003-01`, `SCN-ORD-004-01` | シナリオ E2E | 書き込み可能なデータディレクトリと 200 OK の外部スタブで実サーバを起動 | POST `/orders`, POST `/orders/{id}/confirm`, POST `/orders/{id}/cancel` | `Draft` -> `Confirmed` -> `Cancelled` の遷移、合計表示、JSON 永続化 | P1 | `scripts/test-integration.sh` |
| `IT-ORD-002` | E2E で不正な注文入力を拒否する | `SCN-ORD-001-02` | 境界値 | 実サーバ起動 | `quantity=0` で POST `/orders` | HTTP 422 と検証エラー表示、ファイル未作成 | P1 | `scripts/test-integration.sh` |
| `IT-ORD-003` | 不正な状態遷移を拒否する | `SCN-ORD-002-02`, `SCN-ORD-003-02` | 状態遷移 | キャンセル済み注文が永続化されている | POST `/orders/{id}/confirm` と `/orders/{id}/cancel` | HTTP 422 と状態遷移エラー表示 | P1 | `scripts/test-integration.sh` |
| `IT-ORD-004` | 在庫不足時に確定を失敗させる | `SCN-ORD-002-03` | エラー推測 | `Draft` 注文、在庫スタブが 409 | POST `/orders/{id}/confirm` | HTTP 422 と在庫不足表示、注文は `Draft` のまま | P1 | `scripts/test-integration.sh` |
| `IT-ORD-005` | 決済拒否時に確定を失敗させる | `SCN-ORD-002-03` | エラー推測 | `Draft` 注文、在庫 200・決済 402 | POST `/orders/{id}/confirm` | HTTP 422 と決済拒否表示、注文は `Draft` のまま | P1 | `scripts/test-integration.sh` |
| `IT-ORD-006` | 外部タイムアウト時に確定を失敗させる | `SCN-ORD-002-03` | エラー推測 | `Draft` 注文、決済スタブが `HTTP_TIMEOUT_MS` を超えて遅延 | POST `/orders/{id}/confirm` | HTTP 422 とタイムアウト表示、注文は `Draft` のまま | P2 | `scripts/test-integration.sh` |
| `IT-ORD-007` | 外部サービス利用不可時に確定を失敗させる | `SCN-ORD-002-03` | エラー推測 | `Draft` 注文、在庫 URL が閉じたポート | POST `/orders/{id}/confirm` | HTTP 422 とタイムアウト表示、注文は `Draft` のまま | P2 | `scripts/test-integration.sh` |
| `IT-ORD-008` | 永続化障害時に注文作成を失敗させる | `SCN-ORD-001-03` | 障害注入 | 読み取り専用データディレクトリでサーバ起動 | 有効な POST `/orders` | HTTP 422 と永続化障害表示、注文ファイル未作成 | P1 | `scripts/test-integration.sh` |
| `IT-ORD-009` | 未知の注文取得で 404 を返す | `SCN-ORD-002-02`, `SCN-ORD-004-01` | 同値分割 | 実サーバ起動 | GET `/orders/NO-SUCH` | HTTP 404 と未存在メッセージ | P2 | `scripts/test-integration.sh` |
| `IT-ORD-010` | ローカライズ Web UI 描画（`ja` と `en`） | `SCN-ORD-004-01` | 同値分割 | 既定 `ja` と `APP_LOCALE=en` でサーバ起動 | 各サーバで GET `/` | `<html lang="ja">` と日本語ラベル、`<html lang="en">` と英語ラベル | P2 | `scripts/test-integration.sh` |
| `IT-ORD-011` | 複数明細（1..5） | `SCN-ORD-001-01` | 境界値 | 書き込み可能なデータディレクトリで実サーバ起動 | 2 商品明細で POST `/orders` | HTTP 200、合計金額の描画、両明細の永続化 | P1 | `scripts/test-integration.sh` |

## 異常系チェックリスト

| カテゴリ | ケース ID | 非該当理由 |
| :--- | :--- | :--- |
| 入力境界・不正値 | `IT-ORD-002` | |
| 不正な状態遷移 | `IT-ORD-003` | |
| 外部依存障害（タイムアウト / 拒否 / 利用不可） | `IT-ORD-004`, `IT-ORD-005`, `IT-ORD-006`, `IT-ORD-007` | |
| 永続化・ストレージ障害 | `IT-ORD-008` | |
| 重複・並行競合 | | 単一プロセスのローカル KV ファイル保存でマルチライター排他なし。version 競合は `UT-ORD-066` で検証 |
| 対象未存在 | `IT-ORD-009` | |
| ロケール別描画 | `IT-ORD-010` | |
