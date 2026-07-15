import { useState } from "react";
import CategoryModal from "./category/CategoryModal";
import MembersModal from "./MembersModal";
import { useToast } from "../../../../components/toast/ToastContext";
import type { BoardInfo } from "../../../../types/boardInfo";
import type { Category } from "../../../../types/category";

type Props = {
  boardInfo: BoardInfo;
  onCreateCategory: (boardId: string, name: string, color: string) => void;
  onSetCategory: (
    boardId: string,
    categoryId: string,
    updates: Partial<Category>,
  ) => void;
  onDeleteCategories: (boardId: string, ids: string[]) => void;
  onGetShareLink: (boardId: string) => Promise<string>;
  onLeaveBoard: (boardId: string) => Promise<boolean>;
};

/** ボード上部の管理ツールバー：カテゴリー管理と、オーナー向けの共有リンク。 */
const BoardToolbar = ({
  boardInfo,
  onCreateCategory,
  onSetCategory,
  onDeleteCategories,
  onGetShareLink,
  onLeaveBoard,
}: Props) => {
  const { showToast } = useToast();
  const [showCategories, setShowCategories] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const link = await onGetShareLink(boardInfo.id);
      await navigator.clipboard.writeText(link);
      showToast("共有リンクをコピーしました");
    } catch {
      showToast("共有リンクの取得に失敗しました");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => setShowCategories(true)}
        className="bg-gray-200 px-4 py-1 border btn-base hover:bg-gray-300"
      >
        カテゴリー管理
      </button>

      <button
        type="button"
        onClick={() => setShowMembers(true)}
        className="bg-gray-200 px-4 py-1 border btn-base hover:bg-gray-300 flex items-center gap-1"
      >
        <span className="material-symbols-outlined">group</span>
        メンバー
      </button>

      {/* 共有リンクの発行はオーナーだけ */}
      {boardInfo.role === "owner" && (
        <button
          type="button"
          onClick={handleShare}
          disabled={isSharing}
          className="bg-primary btn-base px-4 py-1 text-white hover:bg-primary-hover disabled:opacity-50 flex items-center gap-1"
        >
          <span className="material-symbols-outlined">share</span>
          共有リンクをコピー
        </button>
      )}

      {showMembers && (
        <MembersModal
          boardInfo={boardInfo}
          onClose={() => setShowMembers(false)}
          onLeaveBoard={onLeaveBoard}
        />
      )}

      {showCategories && (
        <CategoryModal
          categories={boardInfo.categories}
          boardInfo={boardInfo}
          onSetCategory={(categoryId, updates) =>
            onSetCategory(boardInfo.id, categoryId, updates)
          }
          onCreateCategory={onCreateCategory}
          onDeleteCategories={(ids) => onDeleteCategories(boardInfo.id, ids)}
          onClose={() => setShowCategories(false)}
        />
      )}
    </div>
  );
};

export default BoardToolbar;
