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
  isSelectMode: boolean;
  selectedTaskIds: string[];
  onToggleSelectMode: () => void;
  onToggleTaskSelect: (id: string) => void;
  onSetSelectedTaskIds: (ids: string[]) => void;
  onDeleteSelected: () => void;
  onDeleteTask: (taskId: string) => void;
  onSaveTask: (boardId: string, task: TaskInfo) => void;
  onCreateCategory: (name: string, color: string) => void;
  onAdvancePosition: (task: TaskInfo) => void;
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
  isSelectMode,
  selectedTaskIds,
  onToggleSelectMode,
  onToggleTaskSelect,
  onSetSelectedTaskIds,
  onDeleteSelected,
  onDeleteTask,
  onSaveTask,
  onCreateCategory,
  onAdvancePosition,
}: Props) => {
  // 空コンテナにもドロップできるよう、コンテナ自体をドロップ領域にする
  const { setNodeRef } = useDroppable({ id: columnId });

  // タスク新規作成管理
  const [openTaskModal, setOpenTaskModal] = useState(false);

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
      className="bg-white w-60 h-full p-3 shrink-0 gap-3 flex flex-col relative"
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
        {isLastColumn && (
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
          className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto"
        >
          {tasks.map((task) => (
            <Task
              key={task.id}
              boardId={boardInfo.id}
              task={task}
              positionName={positionName}
              category={categories.find((item) => item.id === task.categoryId)}
              categories={categories}
              isSelectMode={selectable}
              checked={selectedTaskIds.includes(task.id)}
              onToggleSelect={onToggleTaskSelect}
              onSaveTask={onSaveTask}
              onCreateCategory={onCreateCategory}
              onAdvancePosition={
                isLastColumn ? undefined : () => onAdvancePosition(task)
              }
              onDelete={() => onDeleteTask(task.id)}
            />
          ))}
        </div>
      </SortableContext>
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
          onConfirm={onDeleteSelected}
          onClose={() => setOpenDeleteModal(false)}
        />
      )}
      {openTaskModal && (
        <TaskModal
          boardId={boardInfo.id}
          positionId={boardInfo.positions[positionIdx]?.id}
          positionName={positionName}
          categories={categories}
          onSaveTask={onSaveTask}
          onCreateCategory={onCreateCategory}
          onClose={() => setOpenTaskModal(false)}
        />
      )}
    </div>
  );
};

export default Container;
