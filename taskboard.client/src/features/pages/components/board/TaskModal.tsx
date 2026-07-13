import { useRef, useState } from "react";
import ModalBase from "../ModalBase";
import CategoryModal from "../modal/CategoryModal";
import type { TaskInfo } from "../../../../types/taskInfo";
import type { Category } from "../../../../types/category";
import SaveButton from "../button/SaveButton";
import BackButton from "../button/BackButton";
import CharCounter from "../../../../components/CharCounter";
import { TEXT_LIMITS } from "../../../../constants/textLimits";

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
      // 実際の値は保存時に「作成先カラムの末尾」として採番される
      orderIndex: 0,
    },
  );

  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Date → "YYYY-MM-DD"(ローカル時間基準。UTC変換による日ズレを防ぐ)
  const formatDate = (date?: Date) => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // "YYYY-MM-DD" → ローカル時間の Date(new Date(str) の UTC解釈による日ズレを防ぐ)
  const parseDate = (value: string): Date | undefined => {
    if (!value) return undefined;
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
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
        <div className="w-100">
          <input
            type="text"
            className="w-full border rounded px-2"
            placeholder="タスク名を入力..."
            maxLength={TEXT_LIMITS.taskName}
            value={draftTask.name}
            onChange={(e) =>
              setDraftTask((prev) => ({ ...prev, name: e.target.value }))
            }
          ></input>
          <CharCounter
            current={draftTask.name.length}
            max={TEXT_LIMITS.taskName}
          />
        </div>
        <div className=" text-gray-500 px-2">{positionName}</div>
      </div>
      <div className="bg-primary-light rounded p-3 flex flex-col gap-5">
        <div>
          <textarea
            ref={textareaRef}
            rows={8}
            maxLength={TEXT_LIMITS.taskComment}
            className="border bg-white rounded w-full resize-none p-2 max-h-80 overflow-auto text-sm"
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
          <CharCounter
            current={draftTask.comment.length}
            max={TEXT_LIMITS.taskComment}
          />
        </div>
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
                deadline: parseDate(e.target.value),
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
