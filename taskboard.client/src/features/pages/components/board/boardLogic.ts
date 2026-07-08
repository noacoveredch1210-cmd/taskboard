// BoardPage の D&D 並べ替えロジックを、DnD イベントや座標計算から切り離した
// 純粋関数群。React/@dnd-kit に依存しないため単体テストしやすい。

import type { TaskInfo } from "../../../../types/taskInfo";

// コンテナ(ドロップ領域)のid。タスクid(UUID)と区別するため接頭辞を付ける
export const COLUMN_PREFIX = "col-";

/** 位置比較に使う矩形（top と height だけ分かればよい） */
export type DragRect = { top: number; height: number };

/** ドロップ解決の結果 */
export type Drop = {
  destPosId: string;
  overTaskId: string | null;
  placeAfter: boolean;
};

/**
 * ドロップ先(position・対象タスク・後ろに入れるか)を解決する。
 * over がコンテナ自体なら末尾追加、タスク上ならそのタスクと同じ position。
 * ポインタ(=active の中心)が対象カードの下半分なら後ろに挿入する。
 */
export const resolveDrop = (
  overId: string | number | null,
  overRect: DragRect | null,
  activeRect: DragRect | null,
  tasks: TaskInfo[],
): Drop | null => {
  if (overId == null) return null;

  // コンテナ自体の上(空コンテナ等) → 末尾に追加
  if (typeof overId === "string" && overId.startsWith(COLUMN_PREFIX)) {
    return {
      destPosId: overId.slice(COLUMN_PREFIX.length),
      overTaskId: null,
      placeAfter: false,
    };
  }

  // タスクの上 → そのタスクと同じ position
  const overTaskId = String(overId);
  const overTask = tasks.find((t) => t.id === overTaskId);
  if (!overTask) return null;

  // ポインタ(ドラッグ中の中心)がカード下半分なら、そのカードの後ろに入れる
  const placeAfter =
    !!activeRect &&
    !!overRect &&
    activeRect.top + activeRect.height / 2 > overRect.top + overRect.height / 2;

  return { destPosId: overTask.positionId, overTaskId, placeAfter };
};

/** positionId -> tasks を position 順に組み立てる(配列順＝表示順)。 */
export const buildColumns = (
  tasks: TaskInfo[],
  positionIds: string[],
): Map<string, TaskInfo[]> => {
  const columns = new Map<string, TaskInfo[]>();
  positionIds.forEach((id) => columns.set(id, []));
  tasks.forEach((t) => columns.get(t.positionId)?.push(t));
  return columns;
};

/** columns を position 順に平坦化する（buildColumns の逆）。 */
export const flattenColumns = (
  columns: Map<string, TaskInfo[]>,
  positionIds: string[],
): TaskInfo[] => positionIds.flatMap((id) => columns.get(id) ?? []);

/**
 * 並べ替え後のタスク配列を計算する。
 * 並びも position も変わらなければ null（再レンダリングのちらつき防止）。
 */
export const buildNextTasks = (
  tasks: TaskInfo[],
  positionIds: string[],
  activeId: string,
  destPosId: string,
  overTaskId: string | null,
  placeAfter: boolean,
): TaskInfo[] | null => {
  const draggedTask = tasks.find((t) => t.id === activeId);
  if (!draggedTask) return null;

  const columns = buildColumns(tasks, positionIds);

  // 移動元から取り除く
  const sourceCol = columns.get(draggedTask.positionId);
  if (!sourceCol) return null;
  const fromIndex = sourceCol.findIndex((t) => t.id === activeId);
  if (fromIndex === -1) return null;
  sourceCol.splice(fromIndex, 1);

  // 挿入位置を決める
  const dest = columns.get(destPosId);
  if (!dest) return null;
  let toIndex: number;
  if (overTaskId === null) {
    // 空きエリア・コンテナ自体の上 → 末尾
    toIndex = dest.length;
  } else if (overTaskId === activeId) {
    // 自分自身の上 → 位置を変えない
    toIndex = fromIndex;
  } else {
    const i = dest.findIndex((t) => t.id === overTaskId);
    toIndex = i === -1 ? dest.length : i + (placeAfter ? 1 : 0);
  }

  // positionId を更新して挿入
  dest.splice(toIndex, 0, { ...draggedTask, positionId: destPosId });

  const next = flattenColumns(columns, positionIds);

  // 並びも position も変わっていなければ更新しない
  const unchanged =
    next.length === tasks.length &&
    next.every(
      (t, i) => t.id === tasks[i].id && t.positionId === tasks[i].positionId,
    );
  return unchanged ? null : next;
};
