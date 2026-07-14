import type { BoardInfo } from "../../../../types/boardInfo";
import type { UserInfo } from "../../../../types/userInfo";

import UserData from "./UserData";
import BoardView from "./board/BoardView";
import LogoutButton from "./LogoutButton";
import DeleteAccountButton from "./DeleteAccountButton";
import JoinBoardButton from "./JoinBoardButton";
import type { Position } from "../../../../types/position";

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
  return (
    <div className="p-10 flex flex-col gap-2">
      <div className="flex pb-5 flex-wrap items-center gap-5">
        <UserData userInfo={userInfo} />
        <JoinBoardButton onJoinBoard={onJoinBoard} />
        <LogoutButton />
      </div>
      <BoardView
        boards={boards}
        onSetBoard={onSetBoard}
        onCreateBoard={onCreateBoard}
        onDeleteBoards={onDeleteBoards}
      />
      {/* 退会は稀で不可逆な操作なので、一番下に控えめに置く */}
      <div className="mt-10 border-t pt-4">
        <DeleteAccountButton />
      </div>
    </div>
  );
};

export default HomePage;
