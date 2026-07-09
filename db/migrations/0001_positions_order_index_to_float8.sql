-- positions.order_index を smallint の IDENTITY 列から double precision へ変更する。
--
-- 背景:
--   Models/Position.cs は double、tasks.order_index も double precision だが、
--   positions.order_index だけ smallint だった。暗黙の代入キャストで小数が丸められるため、
--   タスクと同じ「両隣の中間値」方式で並べ替えを実装すると順序が静かに衝突する。
--
-- IDENTITY は整数型でしか使えないため、先に外してから型を広げる。
-- アプリは常に order_index を明示挿入するので、自動採番の消滅による影響はない。

ALTER TABLE positions ALTER COLUMN order_index DROP IDENTITY IF EXISTS;
ALTER TABLE positions ALTER COLUMN order_index TYPE double precision;
