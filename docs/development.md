# 開発者向けガイド

このアプリをローカルで動かす手順と、API の一覧。
設計の意図や「なぜそうしたか」は [README の「設計上の判断」](../README.md#設計上の判断) にまとめてある。

---

## ローカルでの起動

### 前提

- .NET 10 SDK
- Node.js 20+
- PostgreSQL（または Supabase プロジェクト）

### データベース

`db/schema.sql` を空のデータベースに流し込む。

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

既存のデータベースを更新する場合は `db/migrations/` を番号順に適用する。

### バックエンド

環境変数を設定して起動する。

```bash
export DATABASE_URL="postgresql://user:password@host:5432/postgres"
export SUPABASE_URL="https://<project-ref>.supabase.co"
# 使い方ガイド AI を使う場合のみ（未設定なら AI 呼び出しは 503 を返す）
export GEMINI_API_KEY="<Google AI Studio で取得した無料キー>"

cd TaskBoard.Server
dotnet run
```

`http://localhost:5000` で起動し、開発環境では `http://localhost:5000/swagger` で API を確認できる。

> `GEMINI_API_KEY` は [Google AI Studio](https://aistudio.google.com) の無料キー。サーバー側の環境変数にのみ置き、クライアントには一切渡さない。未設定でもアプリは動作し、AI パネルだけが利用不可になる。

> `Properties/launchSettings.json` は `.gitignore` 済み。ローカルではここに環境変数を書いてもよい。

### フロントエンド

```bash
cd taskboard.client
npm install
npm run dev
```

`http://localhost:5173` で起動する。接続先は `.env.development` で設定する。

> `.env.development` にコミットされている `VITE_SUPABASE_ANON_KEY` は Supabase の publishable key で、ブラウザに配布される前提の公開値。秘匿すべきキーではない（データ保護は JWT 検証とサーバー側の所有権チェックが担う）。

---

## API

すべてのエンドポイントが認証必須。所有者以外のリソースへのアクセスは 404 を返す。

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/users/me` | 自分の情報を取得（初回ログイン時に upsert） |
| PUT | `/api/users/me` | 自分の情報を更新 |
| GET | `/api/boards` | 参加しているボード一覧。中身（列・タスク・カテゴリー・メンバー）を含めて 1 リクエストで返す |
| GET | `/api/categories?boardId={id}` | 指定ボードのカテゴリー一覧 |
| GET | `/api/positions?boardId={id}` | 指定ボードの列一覧 |
| GET | `/api/tasks?boardId={id}` | 指定ボードのタスク一覧 |
| GET | `/api/{boards\|positions\|tasks\|categories}/{id}` | 単体取得 |
| POST | `/api/{boards\|positions\|tasks\|categories}` | 作成 |
| PUT | `/api/{positions\|tasks\|categories}/{id}` | 更新（タスクの更新に order_index は含めない） |
| POST | `/api/tasks/{id}/move` | 並べ替え（両隣を送り、採番はサーバーが行う） |
| PUT | `/api/boards/{id}` | ボード更新（オーナーのみ）。列の並びも丸ごと受け取り、1 トランザクションで適用する |
| DELETE | `/api/{boards\|positions\|tasks\|categories}/{id}` | 削除（ボード・列・タスクはオーナーのみ。タスクはソフト削除） |
| GET | `/api/tasks/trash?boardId={id}` | ゴミ箱一覧（オーナーのみ） |
| POST | `/api/tasks/{id}/restore` | ゴミ箱から復元（オーナーのみ） |
| DELETE | `/api/tasks/{id}/purge` | 完全に削除（オーナーのみ） |
| DELETE | `/api/tasks/trash?boardId={id}` | ゴミ箱を空にする（オーナーのみ） |
| GET | `/api/boards/{id}/share` | 共有トークンを取得（オーナーのみ） |
| POST | `/api/boards/join` | 共有トークンで参加リクエストを送る（承認制） |
| GET | `/api/boards/{id}/members` | メンバー一覧 |
| PUT | `/api/boards/{id}/members/{userId}` | 役割変更（オーナーのみ） |
| DELETE | `/api/boards/{id}/members/{userId}` | メンバーを外す（オーナー） |
| POST | `/api/boards/{id}/leave` | 自分がボードから退出する（最後のオーナーは不可） |
| GET | `/api/boards/{id}/requests` | 保留中の参加リクエスト（オーナーのみ） |
| POST | `/api/boards/{id}/requests/{userId}/approve` | 参加を承認（オーナーのみ） |
| DELETE | `/api/boards/{id}/requests/{userId}` | 参加を却下（オーナーのみ） |
| POST | `/api/ai/chat` | 使い方ガイドへの問い合わせ（Gemini へ中継） |

`/api/ai/chat` はコスト・悪用対策として、全体の 100 回/分とは別に **AI 専用のレート制限（10 回/分/ユーザー）** をかけている。

### 運用向けエンドポイント（認証不要）

| パス | 用途 |
|---|---|
| `/health` | liveness。プロセスが応答するかだけを見る（依存先は見ない） |
| `/health/ready` | readiness。DB へ接続できるかまで確かめ、繋がらなければ 503 |

エラー応答は `application/problem+json`（RFC 9457）で統一している。未処理例外は本番環境ではスタックトレースを含まない 500 を返す。

1 分あたり 100 リクエストのレート制限を設けており、超過すると `Retry-After` を添えて 429 を返す。認証済みなら JWT の `sub`、未認証なら接続元 IP で束ねる。
