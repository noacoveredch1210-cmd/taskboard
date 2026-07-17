// BoardPage の D&D 並べ替えロジックを、DnD イベントや座標計算から切り離した
// 純粋関数群。React/@dnd-kit に依存しないため単体テストしやすい。

import type { TaskInfo } from "../../../../types/taskInfo";

// コンテナ(ドロップ領域)のid。タスクid(UUID)と区別するため接頭辞を付ける
export const COLUMN_PREFIX = "col-";

/** 位置比較に使う矩形（縦方向だけ見る）。 */
export type DragRect = {
  top: number;
  height: number;
};

/** ドロップ解決の結果 */
export type Drop = {
  destPosId: string;
  overTaskId: string | null;
  placeAfter: boolean;
};

/**
 * ドラッグ中の矩形が対象カードの「後ろ半分」にあるかを、縦方向の中心だけで判定する。
 *
 * 横方向は見ない。掴んだカードは対象カードの真上に重なって動くため、
 * 1 列レイアウト（既定）でもグリッドでも両者の矩形はほぼ同じ位置になり、
 * 「隣に並んでいるのか、単に重なっているのか」を矩形だけでは区別できない。
 * 以前は縦に重なっていれば横で判定していたが、1 列では中心 X が一致するため
 * placeAfter が常に false になり、カードを下方向へ移動できなかった。
 *
 * この判定はカーソル位置だけで決まる（現在の並び順に依存しない）ので、
 * dragOver でライブに並べ替えても結果が振動しない。
 * 複数列グリッドでも、対象カードの上半分＝前・下半分＝後ろで挿入先を選べる。
 */
const computePlaceAfter = (
  activeRect: DragRect | null,
  overRect: DragRect | null,
): boolean => {
  if (!activeRect || !overRect) return false;

  const activeCenterY = activeRect.top + activeRect.height / 2;
  const overCenterY = overRect.top + overRect.height / 2;
  return activeCenterY > overCenterY;
};

/**
 * ドロップ先(position・対象タスク・後ろに入れるか)を解決する。
 * over がコンテナ自体なら先頭へ追加、タスク上ならそのタスクと同じ position。
 * ポインタ(=active の中心)が対象カードの下半分なら後ろに挿入する。
 */
export const resolveDrop = (
  overId: string | number | null,
  overRect: DragRect | null,
  activeRect: DragRect | null,
  tasks: TaskInfo[],
): Drop | null => {
  if (overId == null) return null;

  // コンテナ自体の上(空コンテナ等) → 先頭に追加
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

  // ドラッグ中のカードの中心が対象カードの下半分にあれば、そのカードの後ろに入れる。
  const placeAfter = computePlaceAfter(activeRect, overRect);

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
 * ドラッグ中（dragOver）に画面へ反映する並びを計算する。確定は dragEnd。
 *
 * 同じカラム内の並べ替えはここでは反映しない。すき間の見た目は
 * SortableContext（rectSortingStrategy）の transform が出すので不要なうえ、
 * 反映すると壊れるため:
 *   dragOver は「state 更新 → 再計測 → 再判定」で、カーソルを止めていても
 *   繰り返し走る。同じカラム内の規則は「掴んだカードの現在位置」に依存する
 *   （＝冪等でない）ので、[a,b,c] の c を a の上へ運ぶと
 *   [c,a,b] → 次は c が a より前なので「下へ移動」と解釈して [a,c,b] →
 *   また [c,a,b] … と往復し、更新が止まらず React が
 *   Maximum update depth exceeded で落ちる（画面が真っ白になる）。
 *
 * 別カラムへの移動だけは反映する。移動後は「同じカラム」になって
 * ここで打ち切られるため、繰り返しても収束する。
 */
export const buildDragOverTasks = (
  tasks: TaskInfo[],
  positionIds: string[],
  activeId: string,
  destPosId: string,
  overTaskId: string | null,
  placeAfter: boolean,
): TaskInfo[] | null => {
  const draggedTask = tasks.find((t) => t.id === activeId);
  if (!draggedTask) return null;
  if (draggedTask.positionId === destPosId) return null;
  return buildNextTasks(
    tasks,
    positionIds,
    activeId,
    destPosId,
    overTaskId,
    placeAfter,
  );
};

/**
 * 並べ替え後のタスク配列を計算する（dragEnd での確定用）。
 * 並びも position も変わらなければ null（再レンダリングのちらつき防止）。
 *
 * placeAfter は「別のカラムへ移すとき」だけ使う。同じカラム内では
 * 掴んだカードが対象カードの場所を奪う（＝ arrayMove と同じ）規則にする。
 * この規則は掴んだカードの現在位置に依存するので、ドロップ時に一度だけ使う。
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
    // 空きエリア・コンテナ自体の上 → 先頭（新規タスクの追加先と揃える）
    toIndex = 0;
  } else if (overTaskId === activeId) {
    // 自分自身の上 → 位置を変えない
    toIndex = fromIndex;
  } else {
    const i = dest.findIndex((t) => t.id === overTaskId);
    if (i === -1) {
      toIndex = dest.length;
    } else if (draggedTask.positionId === destPosId) {
      // 同じカラム内は、掴んだカードが対象カードの場所を奪う（＝ arrayMove）。
      // 座標で前後を決めない: カードは等幅・等高のグリッドに並ぶので、横に並んだ
      // カードへ左右から重ねると縦の中心がほぼ一致し、数 px のぶれで前後が反転する
      // （＝真ん中へ運んでも元の位置に戻る）。移動方向なら座標に頼らず決まる。
      // i >= fromIndex は「後ろへ動かしている」。対象の後ろへ回り込ませる。
      toIndex = i + (i >= fromIndex ? 1 : 0);
    } else {
      // 別カラムへ移すときは掴んだカードの位置が無いので、座標で前後を決める。
      toIndex = i + (placeAfter ? 1 : 0);
    }
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
