import type { BoardInfo } from "../../../../types/boardInfo";
import type { UserInfo } from "../../../../types/userInfo";
import type { Position } from "../../../../types/position";

import UserData from "./UserData";
import BoardView from "./board/BoardView";
import LogoutButton from "./LogoutButton";
import DeleteAccountButton from "./DeleteAccountButton";
import JoinBoardButton from "./JoinBoardButton";
import CreateButton from "../button/CreateButton";
import { useState } from "react";
import BoardModal from "./board/BoardModal";
import WelcomeModal from "./WelcomeModal";
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
  // board が 0 件のときは、起動（マウント）ごとにウェルカムを出す。
  // 閉じるのはこのセッション限り（次回起動時にまた案内する）。
  const [showWelcome, setShowWelcome] = useState(() => boards.length === 0);

  const dismissWelcome = () => setShowWelcome(false);

  const startCreateFromWelcome = () => {
    setShowWelcome(false);
    setOpenCreateBoardModal(true);
  };

  return (
    <div className="p-10 flex flex-col gap-3">
      <div className=" flex pb-5 flex-wrap items-center gap-5">
        <UserData userInfo={userInfo} />
        <LogoutButton />
      </div>
      <div className="flex gap-3">
        <CreateButton
          buttonName="ボードの追加"
          onOpenModal={() => setOpenCreateBoardModal(true)}
        />
        <JoinBoardButton onJoinBoard={onJoinBoard} />
        {boards.length === 0 && <Hint />}
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
      {showWelcome && (
        <WelcomeModal
          onCreateBoard={startCreateFromWelcome}
          onClose={dismissWelcome}
        />
      )}
    </div>
  );
};

export default HomePage;
