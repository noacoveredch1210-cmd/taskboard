import type { Category } from "../../../../types/category";
import type { TaskInfo } from "../../../../types/taskInfo";
import type { Position } from "../../../../types/position";
import type { Member } from "../../../../types/member";
import TaskModal from "./TaskModal";
import TaskCardContent from "./TaskCardContent";
import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Props = {
  boardId: string;
  task: TaskInfo;
  // 未設定タスクは見つからないので任意
  category?: Category;
  categories?: Category[];
  positions?: Position[];
  // 未割り当てタスクは見つからないので任意
  assignee?: Member;
  members?: Member[];
  onSaveTask: (boardId: string, task: TaskInfo) => void;
  onCreateCategory: (name: string, color: string) => void;
  // 最後のコンテナでは渡されない（進むボタンを出さないため）
  onAdvancePosition?: () => void;
  // 選択モード(最後のコンテナのみ)
  isSelectMode?: boolean;
  checked?: boolean;
  onToggleSelect?: (id: string) => void;
  // ⋯メニューからの1件削除
  onDelete?: () => void;
};

const Task = ({
  boardId,
  task,
  category,
  categories,
  positions,
  assignee,
  members,
  onSaveTask,
  onCreateCategory,
  onAdvancePosition,
  isSelectMode = false,
  checked = false,
  onToggleSelect,
  onDelete,
}: Props) => {
  // タスク編集モーダルの表示管理
  const [openTaskModal, setOpenTaskModal] = useState(false);

  // #region ドラッグ&ドロップ(並べ替え・コンテナ間移動)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    // 選択モード中はドラッグを無効化(クリックは選択に使う)
  } = useSortable({ id: task.id, disabled: isSelectMode });

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    // ドラッグ中は本体を透明にしてプレースホルダ(隙間)として残す。
    // 実際のカードはDragOverlayが表示する。
    opacity: isDragging ? 0 : 1,
  };
  // #endregion

  return (
    <>
      <div className="flex gap-2 items-center w-full min-w-0">
        <button
          ref={setNodeRef}
          style={sortableStyle}
          {...attributes}
          {...listeners}
          data-testid={`task-${task.id}`}
          className="border rounded flex relative h-35 justify-center group hover:shadow-lg touch-none flex-1 min-w-0"
          onClick={() =>
            isSelectMode ? onToggleSelect?.(task.id) : setOpenTaskModal(true)
          }
        >
          <TaskCardContent
            task={task}
            category={category}
            assignee={assignee}
            onAdvancePosition={onAdvancePosition}
            onDelete={onDelete}
          />
        </button>
        {isSelectMode && (
          <input
            type="checkbox"
            checked={checked}
            onChange={() => onToggleSelect?.(task.id)}
            className="w-5 h-5 accent-primary"
          ></input>
        )}
      </div>
      {openTaskModal && (
        <TaskModal
          boardId={boardId}
          task={task}
          categories={categories}
          positions={positions}
          members={members}
          onSaveTask={onSaveTask}
          onCreateCategory={onCreateCategory}
          onClose={() => setOpenTaskModal(false)}
        />
      )}
    </>
  );
};

export default Task;
