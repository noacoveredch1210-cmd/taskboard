import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Search from "./Search";
import Sort, { type SortKey } from "./Sort";
import Filter, { type FilterType } from "./Filter";
import Container from "./Container";
import TaskCardContent from "./TaskCardContent";
import type { BoardInfo } from "../../../../types/boardInfo";
import type { TaskInfo } from "../../../../types/taskInfo";
import type { Category } from "../../../../types/category";

type Props = {
  boardInfo: BoardInfo;
  categories: Category[];
  onSaveTask: (boardId: string, task: TaskInfo) => void;
  onCreateCategory: (name: string, color: string) => void;
  onReorderTasks: (boardId: string, tasks: TaskInfo[]) => void;
  onCommitTaskMove: (
    boardId: string,
    movedTaskId: string,
    tasks: TaskInfo[],
  ) => void;
  onDeleteTasks: (boardId: string, taskIds: string[]) => void;
};

// コンテナ(ドロップ領域)のid。タスクid(UUID)と区別するため接頭辞を付ける
const COLUMN_PREFIX = "col-";

const BoardPage = ({
  boardInfo,
  categories,
  onSaveTask,
  onCreateCategory,
  onReorderTasks,
  onCommitTaskMove,
  onDeleteTasks,
}: Props) => {
  // ドラッグ中のタスク(DragOverlay表示用)
  const [activeTask, setActiveTask] = useState<TaskInfo | null>(null);

  // #region 最後のコンテナのタスク選択・削除
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  const toggleSelectMode = () => {
    setIsSelectMode((prev) => !prev);
    setSelectedTaskIds([]);
  };

  const toggleTaskSelect = (id: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleDeleteSelected = () => {
    onDeleteTasks(boardInfo.id, selectedTaskIds);
    setSelectedTaskIds([]);
    setIsSelectMode(false);
  };
  // #endregion

  // クリック(モーダル表示)とドラッグを両立させるため、8px動いたらドラッグ開始
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // 検索(タスク名・コメントの部分一致)
  const [searchQuery, setSearchQuery] = useState("");

  // 並び替え(表示順のみ。手動D&Dの保存順は変更しない)
  const [sortKey, setSortKey] = useState<SortKey>("");

  // 絞り込み
  const [filterType, setFilterType] = useState<FilterType>("");
  const [filterValue, setFilterValue] = useState("");

  const handleChangeFilterType = (type: FilterType) => {
    setFilterType(type);
    setFilterValue(""); // 種類を変えたら値をリセット
  };

  // #region 絞り込み条件に合うか
  const matchesFilter = (t: TaskInfo): boolean => {
    // 種類か値が未選択なら全部表示
    if (!filterType || !filterValue) return true;
    switch (filterType) {
      case "deadline": {
        // 選択日「まで」(その日以前)の期限を持つタスク。期限未設定は除外
        const d = t.deadline?.toISOString().split("T")[0];
        return d !== undefined && d <= filterValue;
      }
      case "importance":
        return t.importance === Number(filterValue);
      case "category":
        return t.categoryId === filterValue;
      default:
        return true;
    }
  };
  // #endregion

  // #region 検索キーワードに合うか(タスク名・コメントの部分一致)
  const matchesSearch = (t: TaskInfo): boolean => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      t.name.toLowerCase().includes(query) ||
      t.comment.toLowerCase().includes(query)
    );
  };
  // #endregion

  // #region tasksを絞り込んでpositionId(コンテナ)ごとにまとめる
  const grouped = boardInfo.tasks
    ?.filter(matchesFilter)
    .filter(matchesSearch)
    .reduce<Record<string, TaskInfo[]>>((acc, item) => {
      (acc[item.positionId] ??= []).push(item);
      return acc;
    }, {});
  // #endregion

  // #region 選択された並び順でコンテナ内を表示ソートする
  const categoryName = (t: TaskInfo) =>
    categories.find((c) => c.id === t.categoryId)?.name ?? "";

  const compareTasks = (a: TaskInfo, b: TaskInfo): number => {
    switch (sortKey) {
      case "deadline-asc":
      case "deadline-desc": {
        const da = a.deadline?.getTime();
        const db = b.deadline?.getTime();
        // 期限未設定は常に末尾へ
        if (da === undefined && db === undefined) return 0;
        if (da === undefined) return 1;
        if (db === undefined) return -1;
        return sortKey === "deadline-asc" ? da - db : db - da;
      }
      case "importance-desc":
        return b.importance - a.importance;
      case "importance-asc":
        return a.importance - b.importance;
      case "category":
        return categoryName(a).localeCompare(categoryName(b), "ja");
      default:
        return 0;
    }
  };

  if (sortKey && grouped) {
    Object.values(grouped).forEach((column) => column.sort(compareTasks));
  }
  // #endregion

  // ドラッグ中のカードに表示するカテゴリ(未設定なら undefined)
  const activeCategory = categories.find(
    (c) => c.id === activeTask?.categoryId,
  );

  // positionId -> tasks をposition順に組み立てる(配列順＝表示順)
  const buildColumns = (tasks: TaskInfo[]) => {
    const columns = new Map<string, TaskInfo[]>();
    boardInfo.positions.forEach((p) => columns.set(p.id, []));
    tasks.forEach((t) => columns.get(t.positionId)?.push(t));
    return columns;
  };

  const flattenColumns = (columns: Map<string, TaskInfo[]>) =>
    boardInfo.positions.flatMap((p) => columns.get(p.id) ?? []);

  // #region ドロップ先(position・タスク・挿入が後ろか)を解決する
  const resolveOver = (event: DragEndEvent | DragOverEvent) => {
    const { active, over } = event;
    if (!over) return null;

    // コンテナ自体の上(空コンテナ等) → 末尾に追加
    if (typeof over.id === "string" && over.id.startsWith(COLUMN_PREFIX)) {
      return {
        destPosId: over.id.slice(COLUMN_PREFIX.length),
        overTaskId: null as string | null,
        placeAfter: false,
      };
    }

    // タスクの上 → そのタスクと同じposition
    const overTaskId = String(over.id);
    const overTask = boardInfo.tasks?.find((t) => t.id === overTaskId);
    if (!overTask) return null;

    // ポインタ(ドラッグ中の中心)がカード下半分なら、そのカードの後ろに入れる
    const activeRect = active.rect.current.translated;
    const placeAfter =
      !!activeRect &&
      activeRect.top + activeRect.height / 2 >
        over.rect.top + over.rect.height / 2;

    return { destPosId: overTask.positionId, overTaskId, placeAfter };
  };
  // #endregion

  // #region 並べ替え後のタスク配列を計算する(変化が無ければnull)
  const buildNextTasks = (
    activeId: string,
    destPosId: string,
    overTaskId: string | null,
    placeAfter: boolean,
  ): TaskInfo[] | null => {
    const tasks = boardInfo.tasks ?? [];
    const draggedTask = tasks.find((t) => t.id === activeId);
    if (!draggedTask) return null;

    const columns = buildColumns(tasks);

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

    // positionIdを更新して挿入
    dest.splice(toIndex, 0, { ...draggedTask, positionId: destPosId });

    const next = flattenColumns(columns);

    // 並びもpositionも変わっていなければ更新しない(再レンダリングのちらつき防止)
    const unchanged =
      next.length === tasks.length &&
      next.every(
        (t, i) => t.id === tasks[i].id && t.positionId === tasks[i].positionId,
      );
    return unchanged ? null : next;
  };
  // #endregion

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    setActiveTask(boardInfo.tasks?.find((t) => t.id === id) ?? null);
  };

  // ドラッグ中はカーソル位置にライブ追従(元は詰まり、移動先のカーソル位置に空く)。
  // 同一コンテナ内・コンテナ間どちらもここで反映し、確定はdragEndで行う。
  const handleDragOver = (event: DragOverEvent) => {
    const resolved = resolveOver(event);
    if (!resolved) return;

    const next = buildNextTasks(
      String(event.active.id),
      resolved.destPosId,
      resolved.overTaskId,
      resolved.placeAfter,
    );
    if (next) onReorderTasks(boardInfo.id, next);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);

    const resolved = resolveOver(event);
    if (!resolved) return;

    const movedTaskId = String(event.active.id);
    const next = buildNextTasks(
      movedTaskId,
      resolved.destPosId,
      resolved.overTaskId,
      resolved.placeAfter,
    );
    if (next) onReorderTasks(boardInfo.id, next);

    // dragOver で既に反映済みだと next は null になるため、その場合は
    // 現在の state をそのまま保存対象にする（並びは確定済み）
    const finalTasks = next ?? boardInfo.tasks ?? [];
    // 動いた 1 件の order_index を確定して DB へ保存する
    onCommitTaskMove(boardInfo.id, movedTaskId, finalTasks);
  };

  // #region 次のpositionの先頭に移る
  const handleAdvancePosition = (task: TaskInfo) => {
    const idx = boardInfo.positions.findIndex((p) => p.id === task.positionId);
    // 見つからない or すでに最後のpositionなら何もしない
    if (idx === -1 || idx >= boardInfo.positions.length - 1) return;
    const destPosId = boardInfo.positions[idx + 1].id;

    const columns = buildColumns(boardInfo.tasks ?? []);

    // 移動元から取り除く
    const sourceCol = columns.get(task.positionId);
    if (!sourceCol) return;
    const fromIndex = sourceCol.findIndex((t) => t.id === task.id);
    if (fromIndex === -1) return;
    sourceCol.splice(fromIndex, 1);

    // 次のpositionの先頭へ入れる
    columns.get(destPosId)?.unshift({ ...task, positionId: destPosId });

    const next = flattenColumns(columns);
    onReorderTasks(boardInfo.id, next);
    // 動いた 1 件の order_index を確定して DB へ保存する
    onCommitTaskMove(boardInfo.id, task.id, next);
  };
  // #endregion

  return (
    <div className="p-5 flex-col flex gap-5 h-full">
      <Search value={searchQuery} onChange={setSearchQuery} />
      <div className="flex gap-5">
        <Sort value={sortKey} onChange={setSortKey} />
        <Filter
          categories={categories}
          filterType={filterType}
          filterValue={filterValue}
          onChangeType={handleChangeFilterType}
          onChangeValue={setFilterValue}
        />
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* w-max で内容幅に合わせ、pr-5 の右余白を横スクロール領域に含める
            (親の p-5 は列が overflow で突き抜けるため右端に効かない) */}
        <div className="flex gap-5 flex-1 w-max pr-5">
          {boardInfo.positions.map((position, idx) => (
            <Container
              key={position.id}
              boardInfo={boardInfo}
              columnId={`${COLUMN_PREFIX}${position.id}`}
              positionName={position.name}
              positionIdx={idx}
              taskLength={grouped?.[position.id]?.length ?? 0}
              isLastColumn={idx === boardInfo.positions.length - 1}
              tasks={grouped?.[position.id] ?? []}
              categories={categories}
              isSelectMode={isSelectMode}
              selectedTaskIds={selectedTaskIds}
              onToggleSelectMode={toggleSelectMode}
              onToggleTaskSelect={toggleTaskSelect}
              onSetSelectedTaskIds={setSelectedTaskIds}
              onDeleteSelected={handleDeleteSelected}
              onDeleteTask={(taskId) => onDeleteTasks(boardInfo.id, [taskId])}
              onSaveTask={onSaveTask}
              onCreateCategory={onCreateCategory}
              onAdvancePosition={handleAdvancePosition}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className="border rounded flex relative bg-white shadow-2xl cursor-grabbing w-54">
              <TaskCardContent task={activeTask} category={activeCategory} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default BoardPage;
