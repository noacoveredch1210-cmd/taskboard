-- 共有リンクからの参加を「承認制」にする。
-- リンクを開いた人は即メンバーにはならず、参加リクエストとして保留し、
-- オーナーが承認するとメンバーになる。
--
-- board_members（＝アクティブなメンバー）とは別テーブルにすることで、
-- 既存のアクセス判定（メンバーシップ）には一切手を入れない。

CREATE TABLE board_join_requests (
    board_id    uuid        NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
    user_id     uuid        NOT NULL REFERENCES users (id)  ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (board_id, user_id)
);
CREATE INDEX board_join_requests_board_id_idx ON board_join_requests (board_id);
