import { useRef, useState } from "react";
import ModalBase from "../ModalBase";
import CategoryModal from "../modal/CategoryModal";
import type { TaskInfo } from "../../../../types/taskInfo";
import type { Category } from "../../../../types/category";
import SaveButton from "../button/SaveButton";
import BackButton from "../button/BackButton";

export type TaskModalProps = {
  boardId: string;
  task?: TaskInfo;
  // 新規作成時の作成先position(編集時は不要)
  positionId?: string;
  positionName: string;
  categories?: Category[];
  // 保存(idが既存なら更新、無ければ追加のupsert)
  onSaveTask: (boardId: string, task: TaskInfo) => void;
  onCreateCategory: (name: string, color: string) => void;
  onClose: () => void;
};

const blank = "　";

const TaskModal = ({
  boardId,
  task,
  positionId,
  positionName,
  categories,
  onSaveTask,
  onCreateCategory,
  onClose,
}: TaskModalProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [draftTask, setDraftTask] = useState<TaskInfo>(
    task ?? {
      id: crypto.randomUUID(),
      name: "",
      comment: "",
      importance: 0,
      categoryId: "",
      positionId: positionId ?? "",
    },
  );

  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Date → stringｒ
  const formatDate = (date?: Date) => {
    if (!date) return "";
    return date.toISOString().split("T")[0];
  };

  // #region 確定処理
  const handleConfirm = () => {
    // draftTaskは完全なTaskInfo。idが既存なら更新、無ければ追加される
    onSaveTask(boardId, draftTask);
  };
  // #endregion
  return (
    <ModalBase className="p-5 w-150 flex flex-col gap-3" onClose={onClose}>
      <div className="flex gap-2">
        <input
          type="text"
          className="w-100 border rounded px-2"
          placeholder="タスク名を入力..."
          value={draftTask.name}
          onChange={(e) =>
            setDraftTask((prev) => ({ ...prev, name: e.target.value }))
          }
        ></input>
        <div className=" text-gray-500 px-2">{positionName}</div>
      </div>
      <div className="bg-primary-light rounded p-3 flex flex-col gap-5">
        <textarea
          ref={textareaRef}
          rows={3}
          className="border bg-white rounded w-full resize-none p-2 max-h-40 overflow-auto"
          placeholder="説明・コメントを入力..."
          value={draftTask.comment}
          onChange={(e) => {
            setDraftTask((prev) => ({ ...prev, comment: e.target.value }));

            // テキスト量によって高さを調整する
            const el = textareaRef.current;
            if (!el) return;
            el.style.height = "auto"; // 一旦リセット
            el.style.height = el.scrollHeight + "px"; // 中身に合わせる
          }}
        ></textarea>
        <div className="grid grid-cols-2 grid-rows-3 w-80 gap-3">
          <div className="grid col-span-1">優先度・重要度</div>
          <select
            value={draftTask.importance}
            onChange={(e) =>
              setDraftTask((prev) => ({
                ...prev,
                importance: Number(e.target.value),
              }))
            }
            className="border rounded bg-white w-50 px-2"
          >
            <option value="0">{blank}</option>
            <option value="1">低</option>
            <option value="2">中</option>
            <option value="3">高</option>
          </select>

          <div>期限</div>
          <input
            type="date"
            value={formatDate(draftTask.deadline)}
            onChange={(e) =>
              setDraftTask((prev) => ({
                ...prev,
                deadline: new Date(e.target.value),
              }))
            }
            className="border bg-white rounded w-50 px-2"
          ></input>

          <div>カテゴリー</div>
          <div className="flex gap-3 w-50">
            <select
              value={draftTask.categoryId}
              onChange={(e) =>
                setDraftTask((prev) => ({
                  ...prev,
                  categoryId: e.target.value,
                }))
              }
              className="border rounded bg-white flex-1 px-2"
            >
              <option value="">未設定</option>
              {categories?.map((categoryInfo) => (
                <option key={categoryInfo.id} value={categoryInfo.id}>
                  {categoryInfo.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowCategoryModal(true)}
              className="rounded border flex items-center bg-white hover:bg-gray-100"
            >
              <span className="material-symbols-outlined">add</span>
            </button>
          </div>
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <BackButton onClose={onClose} />
        <SaveButton
          onSave={() => {
            if (draftTask.name !== "") handleConfirm();
          }}
          onClose={onClose}
        />
      </div>
      {showCategoryModal && (
        <CategoryModal
          onClose={() => setShowCategoryModal(false)}
          onCreateCategory={onCreateCategory}
        />
      )}
    </ModalBase>
  );
};

export default TaskModal;
