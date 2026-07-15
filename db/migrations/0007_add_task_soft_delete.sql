-- タスクの削除をハード削除からソフト削除に変える（ゴミ箱機能）。
-- deleted_at が NULL なら通常のタスク、非 NULL ならゴミ箱に入っている。
-- 通常の一覧は deleted_at IS NULL で絞り、ゴミ箱（オーナーのみ）は非 NULL を見る。

ALTER TABLE tasks ADD COLUMN deleted_at timestamptz;
