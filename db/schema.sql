-- TaskBoard のデータベーススキーマ。
--
-- 用途:
--   1. 統合テスト用に空の Postgres へ流し込む
--   2. 本番（Supabase）のスキーマをコードレビューの対象に載せる
--
-- 列・型・デフォルト・主キー・UNIQUE・外部キーは本番（Supabase）から確認済み。
-- varchar の長さ上限のみ未確認（下部の TODO を参照）。

-- 本番では Supabase が auth スキーマを提供する。統合テストで素の Postgres に流せるよう、
-- users_id_fkey の参照先だけをスタブとして用意する（本番では既に存在するため作られない）。
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);

-- id には Supabase Auth の JWT の sub クレームを明示挿入する（UsersController.GetMe の upsert）。
-- 認証ユーザーを削除すると、この行を起点に boards → positions/tasks まで連鎖して消える。
CREATE TABLE users (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        varchar     NOT NULL,
    email       varchar     NOT NULL UNIQUE,                        -- users_email_key
    created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users
    ADD CONSTRAINT users_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;

CREATE TABLE boards (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    short_name  varchar     NOT NULL,
    title       varchar     NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE categories (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name        varchar     NOT NULL,
    color       varchar     NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE positions (
    id           uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id     uuid             NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
    name         varchar          NOT NULL,
    -- 元は smallint の IDENTITY 列。migrations/0001 で tasks.order_index と同じ型に揃えた。
    order_index  double precision NOT NULL,
    created_at   timestamptz      NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
    id           uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id     uuid             NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
    -- 列やカテゴリーを消してもタスクは残す（未配置・未分類になる）。
    position_id  uuid             REFERENCES positions (id) ON DELETE SET NULL,
    category_id  uuid             REFERENCES categories (id) ON DELETE SET NULL,
    name         varchar          NOT NULL,
    comment      text,
    importance   integer,
    deadline     date,
    order_index  double precision NOT NULL DEFAULT 0,
    created_at   timestamptz      NOT NULL DEFAULT now()
);

-- 外部キーの列には索引が自動生成されない（主キーと UNIQUE には作られる）。
-- 所有権チェック（Data/*Repository.cs）が boards.user_id と board_id を常に辿るため、
-- 一覧取得と EXISTS 判定の両方がこれらに乗る。migrations/0003 で追加。
CREATE INDEX boards_user_id_idx      ON boards     (user_id);
CREATE INDEX categories_user_id_idx  ON categories (user_id);
CREATE INDEX positions_board_id_idx  ON positions  (board_id);
CREATE INDEX tasks_board_id_idx      ON tasks      (board_id);
CREATE INDEX tasks_position_id_idx   ON tasks      (position_id);
CREATE INDEX tasks_category_id_idx   ON tasks      (category_id);

-- varchar の長さ上限は本番未確認のため、ここでは無制限として書いている。
-- 入力長は Models/TextLimits.cs の [MaxLength] で 400 として弾くため、列側の制約には依存しない。
-- （Postgres では長さ無指定の varchar は text と同等で、性能上の不利もない）
