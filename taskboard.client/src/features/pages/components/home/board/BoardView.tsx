import type { BoardInfo } from "../../../../../types/boardInfo";
import type { Position } from "../../../../../types/position";
import BoardCard from "./BoardCard";
import BoardModal from "./BoardModal";
import DeleteModal from "../../modal/DeleteModal";
import View from "../View";

type Props = {
  boards: BoardInfo[];
  onSetBoard: (id: string, updates: Partial<BoardInfo>) => void;
  onCreateBoard: (
    title: string,
    shortName: string,
    positions: Position[],
  ) => void;
  onDeleteBoards: (ids: string[]) => void;
};

const BoardView = ({
  boards,
  onSetBoard,
  onCreateBoard,
  onDeleteBoards,
}: Props) => (
  <View
    title="board 管理"
    items={boards}
    onDelete={onDeleteBoards}
    emptyHint="board を追加"
    renderItem={(board, ctx) => (
      <BoardCard boardInfo={board} onSetBoard={onSetBoard} {...ctx} />
    )}
    renderCreateModal={(close) => (
      <BoardModal onClose={close} onCreateBoard={onCreateBoard} />
    )}
    renderConfirmModal={(onConfirm, close) => (
      <DeleteModal
        message="選択したboardを削除しますか？"
        onConfirm={onConfirm}
        onClose={close}
      />
    )}
  />
);

export default BoardView;
