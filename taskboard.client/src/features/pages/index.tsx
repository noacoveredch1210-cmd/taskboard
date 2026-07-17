import HomePage from "./components/home/HomePage";
import BoardPage from "./components/board/BoardPage";

import type { UserInfo } from "../../types/userInfo";
import type { BoardInfo } from "../../types/boardInfo";
import type { Category } from "../../types/category";
import type { TaskInfo } from "../../types/taskInfo";
import type { Position } from "../../types/position";

type Props = {
  userInfo: UserInfo;
  boards: BoardInfo[];
  openingPageIndex: number | null;
  onSaveTask: (boardId: string, task: TaskInfo) => void;
  onSetCategory: (
    boardId: string,
    categoryId: string,
    updates: Partial<Category>,
  ) => void;
  onCreateCategory: (boardId: string, name: string, color: string) => void;
  onDeleteCategories: (boardId: string, ids: string[]) => void;
  onSetBoard: (id: string, updates: Partial<BoardInfo>) => void;
  onCreateBoard: (
    title: string,
    shortName: string,
    positions: Position[],
  ) => void;
  onDeleteBoards: (ids: string[]) => void;
  onReorderTasks: (boardId: string, tasks: TaskInfo[]) => void;
  onCommitTaskMove: (
    boardId: string,
    movedTaskId: string,
    tasks: TaskInfo[],
    tasksBeforeMove: TaskInfo[],
  ) => void;
  onDeleteTasks: (boardId: string, taskIds: string[]) => void;
  onGetShareLink: (boardId: string) => Promise<string>;
  onJoinBoard: (token: string) => Promise<"member" | "requested" | null>;
  onLeaveBoard: (boardId: string) => Promise<boolean>;
  onRestoreTask: (boardId: string, task: TaskInfo) => Promise<boolean>;
};

const Pages = ({
  userInfo,
  boards,
  openingPageIndex,
  onSaveTask,
  onSetCategory,
  onCreateCategory,
  onDeleteCategories,
  onSetBoard,
  onCreateBoard,
  onDeleteBoards,
  onReorderTasks,
  onCommitTaskMove,
  onDeleteTasks,
  onGetShareLink,
  onJoinBoard,
  onLeaveBoard,
  onRestoreTask,
}: Props) => {
  // 開いていた board が消えることがある（削除・退出・作成の巻き戻し）。
  // 範囲外の index をそのまま渡すと undefined を触って描画中に落ちるので、ホームへ戻す。
  const openingBoard =
    openingPageIndex === null ? undefined : boards[openingPageIndex];

  return (
    <>
      {!openingBoard ? (
        <div className="w-full">
          <HomePage
            userInfo={userInfo}
            boards={boards}
            onSetBoard={onSetBoard}
            onCreateBoard={onCreateBoard}
            onDeleteBoards={onDeleteBoards}
            onJoinBoard={onJoinBoard}
          />
        </div>
      ) : (
        <div className="h-full">
          <BoardPage
            boardInfo={openingBoard}
            onSaveTask={onSaveTask}
            onCreateCategory={onCreateCategory}
            onSetCategory={onSetCategory}
            onDeleteCategories={onDeleteCategories}
            onReorderTasks={onReorderTasks}
            onCommitTaskMove={onCommitTaskMove}
            onDeleteTasks={onDeleteTasks}
            onGetShareLink={onGetShareLink}
            onLeaveBoard={onLeaveBoard}
            onRestoreTask={onRestoreTask}
          />
        </div>
      )}
    </>
  );
};

export default Pages;
