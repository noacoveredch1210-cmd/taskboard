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
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- 作成者。アカウント削除時のカスケードの起点として残す（アクセス判定は board_members で行う）。
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    short_name   varchar     NOT NULL,
    title        varchar     NOT NULL,
    -- 共有リンク用のトークン。これを知っているログインユーザーはメンバーとして参加できる。
    share_token  uuid        NOT NULL DEFAULT gen_random_uuid() UNIQUE,   -- boards_share_token_key
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- ボードのメンバーシップ。アクセス権はこの表で判定する（1 ボードを複数ユーザーで共有）。
-- role='owner' はボード削除・メンバー管理ができる。作成者は作成時に owner として登録される。
CREATE TABLE board_members (
    board_id    uuid        NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
    user_id     uuid        NOT NULL REFERENCES users (id)  ON DELETE CASCADE,
    role        varchar     NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (board_id, user_id)
);

-- 共有リンクからの参加リクエスト（保留中）。オーナーが承認すると board_members へ移す。
-- board_members とは分けることで、既存のアクセス判定（メンバー = board_members）に手を入れない。
CREATE TABLE board_join_requests (
    board_id    uuid        NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
    user_id     uuid        NOT NULL REFERENCES users (id)  ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (board_id, user_id)
);
CREATE INDEX board_join_requests_board_id_idx ON board_join_requests (board_id);

-- カテゴリーはボードに属する（共有ボードのメンバー全員が同じカテゴリーを使う）。
CREATE TABLE categories (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id    uuid        NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
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
    -- 担当者。board_members から外れてもタスクは残す（未担当に戻る）。
    assignee_id  uuid             REFERENCES users (id) ON DELETE SET NULL,
    name         varchar          NOT NULL,
    comment      text,
    importance   integer,
    deadline     date,
    order_index  double precision NOT NULL DEFAULT 0,
    created_at   timestamptz      NOT NULL DEFAULT now()
);

-- 外部キーの列には索引が自動生成されない（主キーと UNIQUE には作られる）。
-- アクセス判定（Data/*Repository.cs）が board_members と board_id を常に辿るため、
-- 一覧取得と EXISTS 判定の両方がこれらに乗る。
CREATE INDEX boards_user_id_idx           ON boards        (user_id);
-- board_members(board_id, user_id) の複合 PK があるので board_id 先頭の検索は PK で足りる。
-- 「自分が参加しているボード一覧」は user_id 単独で引くため、その索引を足す。
CREATE INDEX board_members_user_id_idx    ON board_members (user_id);
CREATE INDEX categories_board_id_idx      ON categories    (board_id);
CREATE INDEX positions_board_id_idx       ON positions     (board_id);
CREATE INDEX tasks_board_id_idx           ON tasks         (board_id);
CREATE INDEX tasks_position_id_idx        ON tasks         (position_id);
CREATE INDEX tasks_category_id_idx        ON tasks         (category_id);
CREATE INDEX tasks_assignee_id_idx        ON tasks         (assignee_id);

-- varchar の長さ上限は本番未確認のため、ここでは無制限として書いている。
-- 入力長は Models/TextLimits.cs の [MaxLength] で 400 として弾くため、列側の制約には依存しない。
-- （Postgres では長さ無指定の varchar は text と同等で、性能上の不利もない）
