import { useCallback, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Search from "./Search";
import Sort, { type SortKey } from "./Sort";
import Filter, { type FilterType } from "./Filter";
import Container from "./Container";
import TaskCardContent from "./TaskCardContent";
import BoardToolbar from "./BoardToolbar";
import {
  COLUMN_PREFIX,
  resolveDrop,
  buildColumns,
  flattenColumns,
  buildNextTasks,
} from "./boardLogic";
import type { BoardInfo } from "../../../../types/boardInfo";
import type { TaskInfo } from "../../../../types/taskInfo";
import type { Category } from "../../../../types/category";

// ドロップ先はポインタ位置で判定する。
// closestCorners だと縦長のコンテナ矩形は四隅がカードから遠く、元カラムのカードが
// 常に勝ってしまうため、空カラムへ移動できない。
// カードとコンテナが同時に当たったときはカード(＝挿入位置が決まる方)を優先し、
// カードの無い余白ではコンテナ(＝末尾へ追加)を採用する。
const collisionDetection: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  const collisions = pointer.length > 0 ? pointer : rectIntersection(args);
  const onTask = collisions.filter(
    (c) => !String(c.id).startsWith(COLUMN_PREFIX),
  );
  return onTask.length > 0 ? onTask : collisions;
};

type Props = {
  boardInfo: BoardInfo;
  onSaveTask: (boardId: string, task: TaskInfo) => void;
  onCreateCategory: (boardId: string, name: string, color: string) => void;
  onSetCategory: (
    boardId: string,
    categoryId: string,
    updates: Partial<Category>,
  ) => void;
  onDeleteCategories: (boardId: string, ids: string[]) => void;
  onReorderTasks: (boardId: string, tasks: TaskInfo[]) => void;
  onCommitTaskMove: (
    boardId: string,
    movedTaskId: string,
    tasks: TaskInfo[],
    tasksBeforeMove: TaskInfo[],
  ) => void;
  onDeleteTasks: (boardId: string, taskIds: string[]) => void;
  onGetShareLink: (boardId: string) => Promise<string>;
  onLeaveBoard: (boardId: string) => Promise<boolean>;
  onRestoreTask: (boardId: string, task: TaskInfo) => Promise<boolean>;
};

const BoardPage = ({
  boardInfo,
  onSaveTask,
  onCreateCategory,
  onSetCategory,
  onDeleteCategories,
  onReorderTasks,
  onCommitTaskMove,
  onDeleteTasks,
  onGetShareLink,
  onLeaveBoard,
  onRestoreTask,
}: Props) => {
  // カテゴリーはボードに属する。
  const categories = boardInfo.categories;
  // タスクの削除・ゴミ箱はオーナーのみ。
  const canDelete = boardInfo.role === "owner";
  // 子コンポーネントは board を意識しない旧シグネチャを期待するので、ここで board を束ねる。
  const createCategory = (name: string, color: string) =>
    onCreateCategory(boardInfo.id, name, color);
  // ドラッグ中のタスク(DragOverlay表示用)
  const [activeTask, setActiveTask] = useState<TaskInfo | null>(null);
  // ドラッグ開始時点のタスクの並び(保存に失敗したときの巻き戻し先)
  const tasksBeforeDragRef = useRef<TaskInfo[]>([]);

  // 各カラムの幅(px)。未設定のカラムはデフォルト幅(240px)を使う
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  // ドラッグ中(dragOver)のたびに BoardPage が再レンダリングされるため、
  // 参照を安定させて Container 側の resize リスナーが毎回張り直されないようにする。
  const handleResizeColumn = useCallback((positionId: string, width: number) => {
    setColumnWidths((prev) => ({ ...prev, [positionId]: width }));
  }, []);

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

  // ドラッグ中のカードに表示するカテゴリ・担当者(未設定なら undefined)
  const activeCategory = categories.find(
    (c) => c.id === activeTask?.categoryId,
  );
  const activeAssignee = boardInfo.members?.find(
    (m) => m.id === activeTask?.assigneeId,
  );

  // position の並び順（純粋関数へ渡す）
  const positionIds = boardInfo.positions.map((p) => p.id);

  // ドロップ先(position・タスク・挿入が後ろか)を解決する
  const resolveOver = (event: DragEndEvent | DragOverEvent) => {
    const { active, over } = event;
    return resolveDrop(
      over?.id ?? null,
      over?.rect ?? null,
      active.rect.current.translated ?? null,
      boardInfo.tasks ?? [],
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    setActiveTask(boardInfo.tasks?.find((t) => t.id === id) ?? null);
    // dragOver で state をライブ更新してしまうため、保存が失敗したときの
    // 巻き戻し先として、ドラッグ開始時点の並びを控えておく。
    tasksBeforeDragRef.current = boardInfo.tasks ?? [];
  };

  // ドラッグ中はカーソル位置にライブ追従(元は詰まり、移動先のカーソル位置に空く)。
  // 同一コンテナ内・コンテナ間どちらもここで反映し、確定はdragEndで行う。
  const handleDragOver = (event: DragOverEvent) => {
    const resolved = resolveOver(event);
    if (!resolved) return;

    const next = buildNextTasks(
      boardInfo.tasks ?? [],
      positionIds,
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
      boardInfo.tasks ?? [],
      positionIds,
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
    onCommitTaskMove(
      boardInfo.id,
      movedTaskId,
      finalTasks,
      tasksBeforeDragRef.current,
    );
  };

  // #region 次のpositionの先頭に移る
  const handleAdvancePosition = (task: TaskInfo) => {
    const idx = boardInfo.positions.findIndex((p) => p.id === task.positionId);
    // 見つからない or すでに最後のpositionなら何もしない
    if (idx === -1 || idx >= boardInfo.positions.length - 1) return;
    const destPosId = boardInfo.positions[idx + 1].id;

    // 保存に失敗したときの巻き戻し先（state を書き換える前に控える）
    const tasksBeforeMove = boardInfo.tasks ?? [];

    const columns = buildColumns(boardInfo.tasks ?? [], positionIds);

    // 移動元から取り除く
    const sourceCol = columns.get(task.positionId);
    if (!sourceCol) return;
    const fromIndex = sourceCol.findIndex((t) => t.id === task.id);
    if (fromIndex === -1) return;
    sourceCol.splice(fromIndex, 1);

    // 次のpositionの先頭へ入れる
    columns.get(destPosId)?.unshift({ ...task, positionId: destPosId });

    const next = flattenColumns(columns, positionIds);
    onReorderTasks(boardInfo.id, next);
    // 動いた 1 件の order_index を確定して DB へ保存する
    onCommitTaskMove(boardInfo.id, task.id, next, tasksBeforeMove);
  };
  // #endregion

  return (
    <div className="p-5 flex-col flex gap-5 h-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Search value={searchQuery} onChange={setSearchQuery} />
        <BoardToolbar
          boardInfo={boardInfo}
          onCreateCategory={onCreateCategory}
          onSetCategory={onSetCategory}
          onDeleteCategories={onDeleteCategories}
          onGetShareLink={onGetShareLink}
          onLeaveBoard={onLeaveBoard}
          onRestoreTask={onRestoreTask}
        />
      </div>
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
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* w-max で内容幅に合わせ、pr-5 の右余白を横スクロール領域に含める
            (親の p-5 は列が overflow で突き抜けるため右端に効かない) */}
        <div className="flex gap-5 flex-1 min-h-0 w-max pr-5">
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
              canDelete={canDelete}
              isSelectMode={isSelectMode}
              selectedTaskIds={selectedTaskIds}
              width={columnWidths[position.id]}
              onToggleSelectMode={toggleSelectMode}
              onToggleTaskSelect={toggleTaskSelect}
              onSetSelectedTaskIds={setSelectedTaskIds}
              onDeleteSelected={handleDeleteSelected}
              onDeleteTask={(taskId) => onDeleteTasks(boardInfo.id, [taskId])}
              onSaveTask={onSaveTask}
              onCreateCategory={createCategory}
              onAdvancePosition={handleAdvancePosition}
              onResizeWidth={handleResizeColumn}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className="border rounded h-35 flex relative bg-white shadow-2xl cursor-grabbing w-54">
              <TaskCardContent
                task={activeTask}
                category={activeCategory}
                assignee={activeAssignee}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default BoardPage;
