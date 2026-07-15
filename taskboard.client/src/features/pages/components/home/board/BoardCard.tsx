import type { BoardInfo } from "../../../../../types/boardInfo";
import { useState } from "react";
import BoardModal from "./BoardModal";

type Props = {
  boardInfo: BoardInfo;
  isSelectMode: boolean;
  checked: boolean;
  onToggleSelect: (id: string) => void;
  onSetBoard: (id: string, updates: Partial<BoardInfo>) => void;
};

const BoardCard = ({
  boardInfo,
  isSelectMode,
  checked,
  onToggleSelect,
  onSetBoard,
}: Props) => {
  const [openCustomModal, setOpenCustomModal] = useState(false);

  // ボードの編集・削除はオーナーのみ。メンバーはホームのカードから操作できない
  // （閲覧・利用はサイドバーからボードを開いて行う）。
  const canManage = boardInfo.role === "owner";

  const handleCardClick = () => {
    if (!canManage) return;
    if (isSelectMode) onToggleSelect(boardInfo.id);
    else setOpenCustomModal(true);
  };

  return (
    <div className="flex gap-2 items-center">
      <button
        onClick={handleCardClick}
        className="w-full grid bg-primary-button rounded border grid-cols-10 hover:bg-primary-button-hover"
      >
        <div className="flex items-center border-r col-span-4 px-2 h-8 min-w-0">
          <span className="truncate">{boardInfo.title}</span>
        </div>
        <div className="flex items-center border-r col-span-2 px-2 h-8 min-w-0">
          <span className="truncate">{boardInfo.shortName}</span>
        </div>
        <div className="flex items-center col-span-4 px-2 h-8 min-w-0">
          <span className="truncate">
            {boardInfo.positions.map((p) => p.name).join(" / ")}
          </span>
        </div>
      </button>
      {openCustomModal && (
        <BoardModal
          onClose={() => setOpenCustomModal(false)}
          board={boardInfo}
          onSetBoard={onSetBoard}
        />
      )}
      {isSelectMode &&
        (canManage ? (
          <input
            type="checkbox"
            checked={checked}
            onChange={() => onToggleSelect(boardInfo.id)}
            className="w-5 h-5 accent-primary"
          ></input>
        ) : (
          // メンバーは削除できないので、選択不可であることを示す
          <input
            type="checkbox"
            disabled
            title="オーナーのみ削除できます"
            className="w-5 h-5 cursor-not-allowed opacity-40"
          ></input>
        ))}
    </div>
  );
};

export default BoardCard;
