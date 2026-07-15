import type { BoardInfo } from "../../../../../types/boardInfo";
import BoardCard from "./BoardCard";
import DeleteModal from "../../modal/DeleteModal";
import SelectButton from "../../button/SelectButton";
import FooterMenu from "../../FooterMenu";
import { useState, useRef, useEffect } from "react";

type Props = {
  boards: BoardInfo[];
  onSetBoard: (id: string, updates: Partial<BoardInfo>) => void;
  onDeleteBoards: (ids: string[]) => void;
};

const BoardView = ({ boards, onSetBoard, onDeleteBoards }: Props) => {
  const [openConfirmModal, setOpenConfirmModal] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  // チェックされたアイテムのid
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const rootRef = useRef<HTMLDivElement>(null);

  // View の外側をクリックしたら選択モードを解除する
  // (モーダル表示中はモーダル操作を優先するので無効)
  useEffect(() => {
    if (!isSelectMode || openConfirmModal !== null) return;
    const handleOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsSelectMode(false);
        setSelectedIds([]);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isSelectMode, openConfirmModal]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // 選択モードを抜けるときは選択をクリア
  const toggleSelectMode = () => {
    setIsSelectMode((prev) => !prev);
    setSelectedIds([]);
  };

  const handleDelete = () => {
    onDeleteBoards(selectedIds);
    setSelectedIds([]);
    setIsSelectMode(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={rootRef}
        className="border-2 w-full min-h-100 max-h-100 overflow-x-auto relative flex flex-col min-w-150"
      >
        <div className="flex justify-between border-b-2 px-2 py-1 bg-primary-light">
          <span>board 管理</span>
          <SelectButton
            isSelectMode={isSelectMode}
            onSetIsSelectMode={toggleSelectMode}
          />
        </div>
        <div className="p-3 flex flex-col gap-2 flex-1 overflow-y-auto min-h-0">
          {boards.map((board) => (
            <BoardCard
              key={board.id}
              boardInfo={board}
              onSetBoard={onSetBoard}
              isSelectMode={isSelectMode}
              checked={selectedIds.includes(board.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
        {isSelectMode && (
          <FooterMenu
            selectLength={selectedIds.length}
            onDelete={() => setOpenConfirmModal(true)}
          />
        )}
        {openConfirmModal && (
          <DeleteModal
            message="選択したboardを削除しますか？"
            onConfirm={handleDelete}
            onClose={() => setOpenConfirmModal(false)}
          />
        )}
      </div>
    </div>
  );
};

export default BoardView;
