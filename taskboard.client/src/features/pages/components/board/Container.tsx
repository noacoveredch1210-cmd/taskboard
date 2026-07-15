import { useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import Task from "./Task";
import CreateTaskButton from "./CreateTaskButton";

import type { TaskInfo } from "../../../../types/taskInfo";
import type { Category } from "../../../../types/category";
import type { BoardInfo } from "../../../../types/boardInfo";
import SelectButton from "../button/SelectButton";
import FooterMenu from "../FooterMenu";
import DeleteModal from "../modal/DeleteModal";
import TaskModal from "./TaskModal";

type Props = {
  boardInfo: BoardInfo;
  columnId: string;
  positionName: string;
  positionIdx: number;
  taskLength: number;
  isLastColumn: boolean;
  tasks: TaskInfo[];
  categories: Category[];
  /** タスク削除の可否（オーナーのみ）。false なら削除 UI を出さない。 */
  canDelete: boolean;
  isSelectMode: boolean;
  selectedTaskIds: string[];
  width: number | undefined;
  onToggleSelectMode: () => void;
  onToggleTaskSelect: (id: string) => void;
  onSetSelectedTaskIds: (ids: string[]) => void;
  onDeleteSelected: () => void;
  onDeleteTask: (taskId: string) => void;
  onSaveTask: (boardId: string, task: TaskInfo) => void;
  onCreateCategory: (name: string, color: string) => void;
  onAdvancePosition: (task: TaskInfo) => void;
  onResizeWidth: (width: number) => void;
};

const Container = ({
  boardInfo,
  columnId,
  positionName,
  positionIdx,
  taskLength,
  isLastColumn,
  tasks,
  categories,
  canDelete,
  isSelectMode,
  selectedTaskIds,
  width,
  onToggleSelectMode,
  onToggleTaskSelect,
  onSetSelectedTaskIds,
  onDeleteSelected,
  onDeleteTask,
  onSaveTask,
  onCreateCategory,
  onAdvancePosition,
  onResizeWidth,
}: Props) => {
  // 空コンテナにもドロップできるよう、コンテナ自体をドロップ領域にする
  const { setNodeRef } = useDroppable({ id: columnId });

  // タスク新規作成管理
  const [openTaskModal, setOpenTaskModal] = useState(false);

  // #region 右端ドラッグでの幅リサイズ
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    // まだリサイズしたことが無ければ、今の実測幅(rootRef)を起点にする
    startWidthRef.current = width ?? rootRef.current?.offsetWidth ?? 280;
    document.body.style.cursor = "col-resize";
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = e.clientX - startXRef.current;
      const next = Math.min(Math.max(startWidthRef.current + delta, 200), 600);
      onResizeWidth(next);
    };
    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onResizeWidth]);
  // #endregion

  // #region 最後のコンテナ、選択関係
  // 選択・削除は最後のコンテナのタスクだけを対象にする
  const selectable = isLastColumn && isSelectMode;

  // このコンテナの全タスクが選択済みか(全選択チェックボックス用)
  const allSelected =
    tasks.length > 0 && tasks.every((t) => selectedTaskIds.includes(t.id));

  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // このコンテナの外をクリックしたら選択モードを解除する
  // (確認モーダル表示中はモーダル操作を優先)
  useEffect(() => {
    if (!selectable || openDeleteModal) return;
    const handleOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onToggleSelectMode();
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [selectable, openDeleteModal, onToggleSelectMode]);
  // #endregion
  return (
    <div
      ref={rootRef}
      style={{
        width: width !== undefined ? `${width}px` : undefined,
      }}
      className={
        width !== undefined
          ? "bg-white h-full p-3 shrink-0 gap-3 flex flex-col relative"
          : "bg-white h-full p-3 shrink-0 gap-3 flex flex-col relative w-[clamp(240px,16vw,400px)]"
      }
    >
      <div className="flex justify-between items-center">
        <div className="flex gap-3 items-center">
          <div className="font-medium text-lg">{positionName}</div>
          <div className="text-sm bg-gray-200 w-10 rounded h-5 flex items-center justify-center">
            {taskLength}
          </div>
          {selectable && (
            // 全選択 / 全解除
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() =>
                onSetSelectedTaskIds(allSelected ? [] : tasks.map((t) => t.id))
              }
              className="w-5 h-5 accent-primary"
            ></input>
          )}
        </div>
        {positionIdx === 0 && (
          <CreateTaskButton onClick={() => setOpenTaskModal(true)} />
        )}
        {isLastColumn && canDelete && (
          <SelectButton
            isSelectMode={isSelectMode}
            onSetIsSelectMode={onToggleSelectMode}
          />
        )}
      </div>
      <SortableContext
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        {/* min-h-0 が無いと flex アイテムは内容の高さを下回れず、コンテナが伸びてしまう */}
        <div
          ref={setNodeRef}
          data-testid={columnId}
          className="grid content-start gap-3 flex-1 min-h-0 overflow-y-auto grid-cols-[repeat(auto-fill,minmax(140px,1fr))]"
        >
          {tasks.map((task) => (
            <Task
              key={task.id}
              boardId={boardInfo.id}
              task={task}
              category={categories.find((item) => item.id === task.categoryId)}
              categories={categories}
              positions={boardInfo.positions}
              assignee={boardInfo.members?.find(
                (m) => m.id === task.assigneeId,
              )}
              members={boardInfo.members}
              isSelectMode={selectable}
              checked={selectedTaskIds.includes(task.id)}
              onToggleSelect={onToggleTaskSelect}
              onSaveTask={onSaveTask}
              onCreateCategory={onCreateCategory}
              onAdvancePosition={
                isLastColumn ? undefined : () => onAdvancePosition(task)
              }
              onDelete={canDelete ? () => onDeleteTask(task.id) : undefined}
            />
          ))}
        </div>
      </SortableContext>
      {/* 右端のドラッグハンドル */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-primary transition-colors"
      />

      {selectable && (
        // コンテナのp-3を打ち消して下端いっぱいに敷く
        <div className="-mx-3 -mb-3">
          <FooterMenu
            selectLength={selectedTaskIds.length}
            onDelete={() => setOpenDeleteModal(true)}
          />
        </div>
      )}
      {openDeleteModal && (
        <DeleteModal
          message="選択したタスクを削除しますか？"
          irreversible={false}
          onConfirm={onDeleteSelected}
          onClose={() => setOpenDeleteModal(false)}
        />
      )}
      {openTaskModal && (
        <TaskModal
          boardId={boardInfo.id}
          positions={boardInfo.positions}
          categories={categories}
          members={boardInfo.members}
          onSaveTask={onSaveTask}
          onCreateCategory={onCreateCategory}
          onClose={() => setOpenTaskModal(false)}
        />
      )}
    </div>
  );
};

export default Container;
