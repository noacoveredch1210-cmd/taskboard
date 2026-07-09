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
  categories: Category[];
  openingPageIndex: number | null;
  onSaveTask: (boardId: string, task: TaskInfo) => void;
  onSetCategory: (categoryId: string, updates: Partial<Category>) => void;
  onCreateCategory: (name: string, color: string) => void;
  onDeleteCategories: (ids: string[]) => void;
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
};

const Pages = ({
  userInfo,
  boards,
  categories,
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
}: Props) => {
  return (
    <>
      {openingPageIndex === null ? (
        <div className="w-full">
          <HomePage
            userInfo={userInfo}
            boards={boards}
            categories={categories}
            onSetCategory={onSetCategory}
            onCreateCategory={onCreateCategory}
            onDeleteCategories={onDeleteCategories}
            onSetBoard={onSetBoard}
            onCreateBoard={onCreateBoard}
            onDeleteBoards={onDeleteBoards}
          />
        </div>
      ) : (
        <div className="h-full">
          <BoardPage
            boardInfo={boards[openingPageIndex]}
            categories={categories}
            onSaveTask={onSaveTask}
            onCreateCategory={onCreateCategory}
            onReorderTasks={onReorderTasks}
            onCommitTaskMove={onCommitTaskMove}
            onDeleteTasks={onDeleteTasks}
          />
        </div>
      )}
    </>
  );
};

export default Pages;
