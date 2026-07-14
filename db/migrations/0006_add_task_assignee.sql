-- タスクに担当者（board のメンバー）を設定できるようにする。
-- board_members から外れても task は残す（未担当に戻る。position/category と同じ扱い）。

ALTER TABLE tasks ADD COLUMN assignee_id uuid REFERENCES users (id) ON DELETE SET NULL;
CREATE INDEX tasks_assignee_id_idx ON tasks (assignee_id);
