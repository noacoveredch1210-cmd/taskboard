-- public.users.id に auth.users(id) への外部キーを張る。
--
-- 背景:
--   認証ユーザー（auth.users）とアプリユーザー（public.users）は同じ id（JWT の sub）で
--   対応づけているだけで、DB 上の関連が無かった。そのため Supabase のダッシュボードから
--   認証ユーザーを削除すると、public.users の行とそのボード・タスクが孤児として残っていた。
--
--   この外部キーにより、認証ユーザーの削除が users → boards → positions/tasks まで連鎖する。
--
-- 前提: public.users に auth.users 側の対応行を持たない行が残っていると、この ALTER は失敗する。
--   SELECT u.id, u.email FROM users u
--   LEFT JOIN auth.users a ON a.id = u.id
--   WHERE a.id IS NULL;

ALTER TABLE users
    ADD CONSTRAINT users_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;
