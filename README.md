# TaskBoard

ドラッグ&ドロップで操作するカンバン形式のタスク管理アプリ。React + ASP.NET Core + PostgreSQL。

**デモ**: https://taskboard-zeta-eight.vercel.app （Google アカウントでログイン）

[![CI](https://github.com/noacoveredch1210-cmd/taskboard/actions/workflows/ci.yml/badge.svg)](https://github.com/noacoveredch1210-cmd/taskboard/actions/workflows/ci.yml)

<!-- TODO: ここに操作の GIF を貼る（ボード作成 → タスク追加 → 列間ドラッグ） -->

---

## 何ができるか

- **ボード**: 複数のボードを作り、列（position）を自由に追加・並べ替え・削除できる
- **タスク**: 名前・コメント・重要度・期限・カテゴリーを設定し、列間をドラッグして移動
- **カテゴリー**: 色付きラベルをユーザー単位で管理し、タスクに割り当てる
- **検索・絞り込み・並べ替え**: タスク名での検索に加え、期限 / 重要度 / カテゴリーでの絞り込みと並べ替え
- **認証**: Google アカウントによるログイン（Supabase Auth）

## 技術スタック

| 領域 | 使用技術 |
|---|---|
| フロントエンド | React 19, TypeScript, Vite, Tailwind CSS v4, dnd-kit |
| バックエンド | ASP.NET Core (.NET 10), Dapper |
| データベース | PostgreSQL (Supabase) |
| 認証 | Supabase Auth (Google OAuth) + JWT 検証 |
| テスト | xUnit + NSubstitute / Vitest + Testing Library |
| デプロイ | Vercel (フロント) / Docker (API) |

## アーキテクチャ

```
┌─────────────┐   ① Google ログイン    ┌──────────────┐
│   ブラウザ   │ ────────────────────► │ Supabase Auth │
│   (React)   │ ◄──────────────────── │              │
└──────┬──────┘   ② JWT (ES256)        └──────┬───────┘
       │                                      │
       │ ③ Authorization: Bearer <JWT>        │ ④ JWKS で公開鍵を取得
       ▼                                      ▼
┌─────────────────────────────────────────────────────┐
│           ASP.NET Core Web API                      │
│                                                     │
│   Controllers  ─── 認証・所有権の起点（sub クレーム）  │
│        │                                            │
│   I*Repository ─── インターフェース越しに DI          │
│        │                                            │
│   *Repository  ─── Dapper。所有権を SQL 述語で強制    │
└────────────────────────┬────────────────────────────┘
                         │
                         ▼
                 ┌───────────────┐
                 │  PostgreSQL   │
                 └───────────────┘
```

クライアントは Supabase から受け取った JWT を `Authorization` ヘッダーに載せるだけで、API は Supabase の JWKS エンドポイントから公開鍵を取得して自前で検証する。API は Supabase の SDK に依存しない。

## 設計上の判断

このプロジェクトで意図的に選んだ設計と、その理由。

### ユーザー ID はトークンからしか取らない

リクエストボディに `userId` が含まれていても無視し、必ず JWT の `sub` クレームを使う。`AuthorizedControllerBase` が `CurrentUserId` として一箇所で提供し、全コントローラーがこれを継承する。クライアントが他人の ID を送りつけてもリソースを作れない。

### 他人のリソースには 403 ではなく 404 を返す

403（禁止）を返すと「その ID のリソースは実在する」という情報が漏れる。存在しない ID と他人の ID を区別できないよう、どちらも 404 に統一している。

### 所有権チェックはアプリ層ではなく SQL に埋める

`if (board.UserId != currentUserId) return Forbid();` のような後付けチェックは、書き忘れると静かに破綻する。代わりに、全クエリの WHERE 句に所有権の述語を置いている。

```sql
-- TaskRepository.cs
WHERE id = @Id
  AND EXISTS (SELECT 1 FROM boards b WHERE b.id = tasks.board_id AND b.user_id = @UserId)
```

行を取得できた時点で所有権は保証されている。UPDATE / DELETE も同様で、影響行数が 0 なら 404 を返す。

### タスクの並び順は fractional indexing

`order_index` を `double precision` にして、タスクを移動したときは**両隣の中間値**を採番する。これにより、並べ替えのたびに更新するのは動かした 1 行だけで済む（連番方式だと後続の全行を UPDATE する必要がある）。

ただし中間値を取り続けると浮動小数の精度が枯渇する。そこで、中間値が両隣と区別できなくなった場合のみ、そのカラムだけ `0, 1, 2, …` に振り直す安全網を入れている（`useBoards.ts` の `rebalanceColumn`）。

### 楽観的更新の失敗は「再取得」と「スナップショット」の二段構えで巻き戻す

すべての更新系は即座に state へ反映してから API を投げる。失敗したらトーストで通知し、**サーバーから状態を取り直す**。

操作ごとに逆操作を書かないのは、`setBoard` のように複数の API を並列に投げる操作では「どこまで成功したか」で正しい逆操作が変わり、部分的な失敗で状態がずれるため。取り直せば、どの経路で失敗しても必ずサーバーの状態に収束する。

ただし通信が切れている場合、この再取得も失敗する。そこで再取得が失敗したときは**操作前のスナップショットへ戻す**。取り直せないほど通信が切れているなら更新もサーバーに届いていないため、操作前の state がサーバーの状態と一致しているとみなせる。

なおドラッグ中は `reorderTasks` が state をライブ更新しているため、`commitTaskMove` の時点でフックが持つ state は既に「移動後」になっている。そのままでは巻き戻せないので、ドラッグ開始時点の並びを `BoardPage` が控えて渡している。

### 入力長の上限はフロントとサーバーの両方で持つ

`Models/TextLimits.cs` と `src/constants/textLimits.ts` に同じ値を置き、フロントは `maxLength` で入力を止め、サーバーは `[MaxLength]` で 400 を返す。フロントのバリデーションは UX のためのものであって、防御ではないため。

### レート制限は認証と認可の「あいだ」に置く

`UseRateLimiter()` を `UseAuthorization()` の後ろに置くと、未認証のリクエストは 401 で打ち切られてレート制限に到達しない。一番制限したい「トークン無しの連打」がそのまま素通りする。

かといって `UseAuthentication()` より前に置くと、`User` がまだ空なのでユーザー単位で数えられず、全員が IP でしか区別できない。

そこで認証と認可の間に置いている。認証は済んでいるので `sub` クレームで束ねられ、認可はまだなので 401 になる呼び出しも数に入る。ヘルスチェックは `DisableRateLimiting()` で除外している（監視の巻き添えで 429 を返さないため）。

### liveness と readiness を分ける

`/health` は依存先を見ず、`/health/ready` だけが DB への接続を確かめる。

コンテナ実行基盤は liveness の失敗を「プロセスが壊れた」と解釈して再起動する。ここに DB のチェックを含めると、DB が数秒不調になっただけでアプリが再起動を繰り返し、状況を悪化させる。「生きている」と「今すぐ仕事を受けられる」は別の状態として扱う。

### 外部キー列に明示的に索引を張る

PostgreSQL は主キーと UNIQUE には索引を自動生成するが、外部キーの参照元列には作らない。所有権チェックがほぼ全てのクエリで `user_id` / `board_id` を辿るため、索引がないと全走査になる（`db/migrations/0003`）。

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

cd TaskBoard.Server
dotnet run
```

`http://localhost:5000` で起動し、開発環境では `http://localhost:5000/swagger` で API を確認できる。

> `Properties/launchSettings.json` は `.gitignore` 済み。ローカルではここに環境変数を書いてもよい。

### フロントエンド

```bash
cd taskboard.client
npm install
npm run dev
```

`http://localhost:5173` で起動する。接続先は `.env.development` で設定する。

> `.env.development` にコミットされている `VITE_SUPABASE_ANON_KEY` は Supabase の publishable key で、ブラウザに配布される前提の公開値。秘匿すべきキーではない（データ保護は JWT 検証とサーバー側の所有権チェックが担う）。

## テスト

```bash
# サーバー単体: xUnit (100 tests)
dotnet test TaskBoard.Server.Tests

# サーバー統合: Testcontainers + PostgreSQL (14 tests)
# Docker が必要。無い環境では自動スキップされる。
dotnet test TaskBoard.Server.IntegrationTests

# クライアント: Vitest (222 tests)
cd taskboard.client
npm run test:run
npm run coverage   # カバレッジ付き

# E2E: Playwright (11 tests)
npx playwright install chromium   # 初回のみ
npm run e2e
npm run e2e:ui                    # 画面を見ながら実行・デバッグ
```

> 統合テストは `db/schema.sql` を空の PostgreSQL コンテナに流し込み、リポジトリを実 DB に対して走らせる。テストごとにコンテナを立てっぱなしにする必要はなく、Testcontainers が起動と破棄を管理する。

### テスト構成

| 対象 | 方針 |
|---|---|
| コントローラー | リポジトリを NSubstitute でモックし、認証・所有権・ステータスコードを検証 |
| リクエストモデル | `[MaxLength]` 等のバリデーション属性を DataAnnotations で直接検証 |
| 型ハンドラ | `DateOnly` ⇄ Npgsql の変換を単体で検証 |
| React コンポーネント | Testing Library でユーザー操作を再現し、DOM の結果を検証 |
| リポジトリ層（統合） | Testcontainers で実 PostgreSQL を立て、所有権チェックの SQL とスキーマ制約を検証 |
| 状態管理フック | `useBoards` を `renderHook` で駆動し、API モジュールをモックして呼び出しを検証 |
| ドメインロジック | `boardLogic.ts` / `board-data.ts` を純粋関数として単体検証 |
| E2E | 実ブラウザでドラッグ&ドロップ、モーダルの Esc / 背景クリック、失敗時の巻き戻しを検証 |

カバレッジは `include: ["src/**/*.{ts,tsx}"]` を指定し、テストから一度も import されないファイルも分母に含めている。

### E2E の範囲

Google OAuth は自動化できず、サーバーは Supabase の JWKS で JWT を検証するためトークンも偽造できない。そこで E2E は**クライアントを実ブラウザで動かす**ところまでを対象とし、`localStorage` にセッションを仕込み、`/api/**` を Playwright の `page.route` で差し替えている。実サーバー・実 DB には接続しないため、CI にシークレットが要らず安定して回る。

この境界は意図的なもので、レイヤーごとにテストを置き分けている。

- **ドラッグ&ドロップと `<dialog>` の挙動** → E2E（jsdom では再現できない）
- **並び順の採番・巻き戻しのロジック** → Vitest
- **SQL と所有権チェック** → サーバー側の統合テスト（未整備。下記参照）

## API

すべてのエンドポイントが認証必須。所有者以外のリソースへのアクセスは 404 を返す。

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/users/me` | 自分の情報を取得（初回ログイン時に upsert） |
| PUT | `/api/users/me` | 自分の情報を更新 |
| GET | `/api/boards` | 自分のボード一覧 |
| GET | `/api/categories` | 自分のカテゴリー一覧 |
| GET | `/api/positions?boardId={id}` | 指定ボードの列一覧 |
| GET | `/api/tasks?boardId={id}` | 指定ボードのタスク一覧 |
| GET | `/api/{boards\|positions\|tasks\|categories}/{id}` | 単体取得 |
| POST | `/api/{boards\|positions\|tasks\|categories}` | 作成 |
| PUT | `/api/{boards\|positions\|tasks\|categories}/{id}` | 更新 |
| DELETE | `/api/{boards\|positions\|tasks\|categories}/{id}` | 削除 |

### 運用向けエンドポイント（認証不要）

| パス | 用途 |
|---|---|
| `/health` | liveness。プロセスが応答するかだけを見る（依存先は見ない） |
| `/health/ready` | readiness。DB へ接続できるかまで確かめ、繋がらなければ 503 |

エラー応答は `application/problem+json`（RFC 9457）で統一している。未処理例外は本番環境ではスタックトレースを含まない 500 を返す。

1 分あたり 100 リクエストのレート制限を設けており、超過すると `Retry-After` を添えて 429 を返す。認証済みなら JWT の `sub`、未認証なら接続元 IP で束ねる。

## 既知の制約・今後

- **E2E は API をスタブしている**。E2E（Playwright）はフロントの結線を確認するもので、`/api` は差し替えている。サーバーと DB まで通すフルスタック E2E は未整備（所有権 SQL 自体は統合テストで実 DB に対して検証済み）。
- **構造化ログが未実装**。現状は既定のコンソールロガーのみで、リクエスト単位の相関 ID を出していない。
