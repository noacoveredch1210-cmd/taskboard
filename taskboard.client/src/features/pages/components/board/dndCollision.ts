// D&D のドロップ先（衝突）判定。@dnd-kit に依存するため boardLogic とは分けている。

import {
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from "@dnd-kit/core";
import { COLUMN_PREFIX } from "./boardLogic";

/**
 * ドロップ先はポインタ位置で判定する。
 *
 * closestCorners だと縦長のコンテナ矩形は四隅がカードから遠く、元カラムのカードが
 * 常に勝ってしまうため、空カラムへ移動できない。
 * カードとコンテナが同時に当たったときはカード(＝挿入位置が決まる方)を優先し、
 * カードの無い余白ではコンテナ(＝末尾へ追加)を採用する。
 * ポインタがどこにも入っていないとき（カラムの隙間など）は矩形の重なりで拾う。
 */
export const collisionDetection: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  const collisions = pointer.length > 0 ? pointer : rectIntersection(args);
  const onTask = collisions.filter(
    (c) => !String(c.id).startsWith(COLUMN_PREFIX),
  );
  return onTask.length > 0 ? onTask : collisions;
};
