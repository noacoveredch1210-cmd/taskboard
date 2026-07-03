import { useEffect, useRef, useState } from "react";
import type { Category } from "../../../../types/category";
import type { TaskInfo } from "../../../../types/taskInfo";

import { getTextColor } from "../../utils/getTextColor";
import DeleteModal from "../modal/DeleteModal";

type Props = {
  task: TaskInfo;
  // 未設定タスクは見つからないので任意
  category?: Category;
  // ドラッグ中のオーバーレイ表示では不要なため任意
  onAdvancePosition?: () => void;
  // ⋯メニューからの1件削除。オーバーレイでは渡されない
  onDelete?: () => void;
};

// タスクカードの見た目だけを担う部品。実カードとドラッグ中のオーバーレイで共有する
const TaskCardContent = ({
  task,
  category,
  onAdvancePosition,
  onDelete,
}: Props) => {
  // #region メニュー
  // 開閉
  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!openMenu) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [openMenu]);
  // #endregion

  // #region 削除モーダル
  const [openModal, setOpenModal] = useState(false);
  // #endregion

  // #region 重要度のカラー
  const importanceColor =
    task.importance === 1 // 低
      ? "bg-importance-low"
      : task.importance === 2 // 中
        ? "bg-importance-medium"
        : task.importance === 3 // 高
          ? "bg-importance-high"
          : "bg-[#ffffff]";
  // #endregion

  const bgColor = category?.color ?? "#e5e7eb"; // 薄グレーにする

  return (
    <>
      <div className={`${importanceColor} border-r w-3 rounded-l`}></div>
      <div className="p-2 flex-1 min-w-0 items-start flex flex-col gap-2">
        <div
          className="inline-block px-2 rounded text-sm"
          style={{
            backgroundColor: bgColor,
            color: category?.color ? getTextColor(bgColor) : "#000000",
          }}
        >
          {category?.name ?? "未設定"}
        </div>
        <div className="w-full line-clamp-2 wrap-break-word text-left">
          {task.name}
        </div>
        <div className="text-gray-400 text-sm">
          {task.deadline?.toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "numeric",
            day: "2-digit",
          }) ?? "期限未設定"}
        </div>
        {/* メニューボタンとポジション移動ボタン（absolute） */}
        <div ref={menuRef} className="absolute top-1 right-1">
          <div
            role="button"
            onClick={(e) => {
              // 外側ボタン(タスク編集モーダル)を開かないように伝播を止める
              e.stopPropagation();
              if (onDelete) setOpenMenu((prev) => !prev);
            }}
            className={`hover:text-primary px-1 pt-1 rounded ${openMenu ? "text-primary" : ""}`}
          >
            <span className="material-symbols-outlined">more_horiz</span>
          </div>
          {openMenu && onDelete && (
            <div className="absolute right-0 top-7 z-20 bg-white border rounded shadow text-sm">
              <div
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenModal(true);
                  setOpenMenu(false);
                }}
                className="flex items-center gap-1 rounded px-3 py-1 text-red-600 hover:bg-gray-100 whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-sm!">
                  delete
                </span>
                削除
              </div>
            </div>
          )}
        </div>
        {onAdvancePosition && (
          <div
            role="button"
            onClick={(e) => {
              // 外側ボタン(タスク編集モーダル)を開かないように伝播を止める
              e.stopPropagation();
              onAdvancePosition?.();
            }}
            className="hidden group-hover:block absolute bottom-1 right-1 rounded bg-primary-button hover:bg-primary-button-hover items-center px-2 text-sm"
          >
            <span className="material-symbols-outlined text-sm!">
              arrow_forward
            </span>
          </div>
        )}
      </div>
      {openModal && onDelete && (
        // カードの<button>内なので、モーダル内クリックが編集モーダルを開かないよう伝播を止める
        <div onClick={(e) => e.stopPropagation()}>
          <DeleteModal
            message="このタスクを削除しますか？"
            onConfirm={() => onDelete()}
            onClose={() => setOpenModal(false)}
          />
        </div>
      )}
    </>
  );
};

export default TaskCardContent;
