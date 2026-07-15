import type { BoardInfo } from "../../../../types/boardInfo";
import type { UserInfo } from "../../../../types/userInfo";
import type { Position } from "../../../../types/position";

import UserData from "./UserData";
import BoardView from "./board/BoardView";
import LogoutButton from "./LogoutButton";
import DeleteAccountButton from "./DeleteAccountButton";
import JoinBoardButton from "./JoinBoardButton";
import CreateButton from "./CreateButton";
import { useState } from "react";
import BoardModal from "./board/BoardModal";
import Hint from "./Hint";

type Props = {
  userInfo: UserInfo;
  boards: BoardInfo[];
  onSetBoard: (id: string, updates: Partial<BoardInfo>) => void;
  onCreateBoard: (
    title: string,
    shortName: string,
    positions: Position[],
  ) => void;
  onDeleteBoards: (ids: string[]) => void;
  onJoinBoard: (token: string) => Promise<"member" | "requested" | null>;
};

const HomePage = ({
  userInfo,
  boards,
  onSetBoard,
  onCreateBoard,
  onDeleteBoards,
  onJoinBoard,
}: Props) => {
  const [openCreateBoardModal, setOpenCreateBoardModal] = useState(false);
  return (
    <div className="p-10 flex flex-col gap-3">
      <div className="flex pb-5 flex-wrap items-center gap-5">
        <UserData userInfo={userInfo} />
        <LogoutButton />
      </div>
      <div className="flex gap-3">
        <CreateButton onOpenModal={() => setOpenCreateBoardModal(true)} />
        <JoinBoardButton onJoinBoard={onJoinBoard} />
        <Hint />
      </div>
      <BoardView
        boards={boards}
        onSetBoard={onSetBoard}
        onDeleteBoards={onDeleteBoards}
      />
      {/* 退会は稀で不可逆な操作なので、一番下に控えめに置く */}
      <div className="mt-10 border-t pt-4">
        <DeleteAccountButton />
      </div>
      {openCreateBoardModal && (
        <BoardModal
          onClose={() => setOpenCreateBoardModal(false)}
          onCreateBoard={onCreateBoard}
        />
      )}
    </div>
  );
};

export default HomePage;
