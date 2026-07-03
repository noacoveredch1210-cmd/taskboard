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

  return (
    <div className="flex gap-2 items-center">
      <button
        onClick={() =>
          isSelectMode ? onToggleSelect(boardInfo.id) : setOpenCustomModal(true)
        }
        className="w-full grid bg-primary-button rounded border grid-cols-10 hover:bg-primary-button-hover"
      >
        <div className="flex items-center border-r col-span-2 px-2 h-8 min-w-0">
          <span className="truncate">{boardInfo.shortName}</span>
        </div>
        <div className="flex items-center border-r col-span-4 px-2 h-8 min-w-0">
          <span className="truncate">{boardInfo.title}</span>
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
      {isSelectMode && (
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggleSelect(boardInfo.id)}
          className="w-5 h-5 accent-primary"
        ></input>
      )}
    </div>
  );
};

export default BoardCard;
