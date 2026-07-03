import type { BoardInfo } from "../../../../types/boardInfo";
import type { UserInfo } from "../../../../types/userInfo";

import UserData from "./UserData";
import BoardView from "./board/BoardView";
import LogoutButton from "./LogoutButton";
import CategoryView from "./category/CategoryView";
import type { Category } from "../../../../types/category";
import type { Position } from "../../../../types/position";

type Props = {
  userInfo: UserInfo;
  boards: BoardInfo[];
  categories: Category[];
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
};

const HomePage = ({
  userInfo,
  boards,
  categories,
  onSetCategory,
  onCreateCategory,
  onDeleteCategories,
  onSetBoard,
  onCreateBoard,
  onDeleteBoards,
}: Props) => {
  return (
    <div className="p-10 flex flex-col gap-2">
      <div className="flex pb-5 gap-20">
        <UserData userInfo={userInfo} />
        <LogoutButton />
      </div>
      <BoardView
        boards={boards}
        onSetBoard={onSetBoard}
        onCreateBoard={onCreateBoard}
        onDeleteBoards={onDeleteBoards}
      />
      <CategoryView
        categories={categories}
        onCreateCategory={onCreateCategory}
        onSetCategory={onSetCategory}
        onDeleteCategories={onDeleteCategories}
      />
    </div>
  );
};

export default HomePage;
