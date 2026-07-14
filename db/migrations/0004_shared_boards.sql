-- 単一オーナーのボードを、複数ユーザーで共有できるボードに変更する。
--
-- 変更点:
--   1. boards に share_token を追加（共有リンク用）。
--   2. board_members を新設し、アクセス判定をオーナー単独からメンバーシップへ移す。
--   3. 既存ボードの作成者を owner としてメンバー登録する。
--   4. categories をユーザー単位からボード単位へ移す。
--
-- 注意: 4 は破壊的。既存のカテゴリーは特定のボードに紐付けられないため、
--       このマイグレーションで削除する（デモ/検証データ前提）。本番投入前に要検討。

BEGIN;

-- 1. 共有トークン
ALTER TABLE boards
    ADD COLUMN share_token uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE boards
    ADD CONSTRAINT boards_share_token_key UNIQUE (share_token);

-- 2. メンバーシップ表
CREATE TABLE board_members (
    board_id    uuid        NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
    user_id     uuid        NOT NULL REFERENCES users (id)  ON DELETE CASCADE,
    role        varchar     NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (board_id, user_id)
);
CREATE INDEX board_members_user_id_idx ON board_members (user_id);

-- 3. 既存ボードの作成者を owner として登録
INSERT INTO board_members (board_id, user_id, role)
SELECT id, user_id, 'owner' FROM boards;

-- 4. categories をボード単位へ
--    既存カテゴリーはボードに割り当てられないため破棄する。
DELETE FROM categories;
DROP INDEX IF EXISTS categories_user_id_idx;
ALTER TABLE categories DROP CONSTRAINT categories_user_id_fkey;
ALTER TABLE categories DROP COLUMN user_id;
ALTER TABLE categories
    ADD COLUMN board_id uuid NOT NULL REFERENCES boards (id) ON DELETE CASCADE;
CREATE INDEX categories_board_id_idx ON categories (board_id);

COMMIT;
