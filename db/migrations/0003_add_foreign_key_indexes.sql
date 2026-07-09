-- 外部キー列に索引を追加する。
--
-- 背景:
--   Postgres は主キーと UNIQUE 制約には索引を自動生成するが、外部キーの参照元列には作らない。
--   所有権チェック（Data/*Repository.cs）の導入により、ほぼ全てのクエリが user_id か board_id を
--   辿るようになったため、索引が無いと該当テーブルを毎回全走査することになる。
--   親行の削除時にカスケードで子テーブルを走査する経路も同様。
--
--   適用時点ではデータ量が小さく体感差は無いが、行数の増加に備えて先に張っておく。

CREATE INDEX boards_user_id_idx      ON boards     (user_id);
CREATE INDEX categories_user_id_idx  ON categories (user_id);
CREATE INDEX positions_board_id_idx  ON positions  (board_id);
CREATE INDEX tasks_board_id_idx      ON tasks      (board_id);
CREATE INDEX tasks_position_id_idx   ON tasks      (position_id);
CREATE INDEX tasks_category_id_idx   ON tasks      (category_id);
