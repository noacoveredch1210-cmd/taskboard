import { useState } from "react";
import Header from "./features/header/index.tsx";
import Sidebar from "./features/sidebar/index.tsx";
import Pages from "./features/pages/index.tsx";
import AI from "./features/AI/index.tsx";
import type { BoardInfo } from "./types/boardInfo.ts";
import type { UserInfo } from "./types/userInfo.ts";
import type { Category } from "./types/category.ts";
import type { TaskInfo } from "./types/taskInfo.ts";
import type { Position } from "./types/position.ts";

// seed(本来はDBから取得)。タスクから参照するためカテゴリー・positionのidを先に確定させておく
const SEED_CAT_SHANAI = crypto.randomUUID();
const SEED_CAT_TORIHIKI = crypto.randomUUID();
const SEED_CAT_PRIVATE = crypto.randomUUID();

const SEED_B1_POS_TODO = crypto.randomUUID();
const SEED_B1_POS_DOING = crypto.randomUUID();
const SEED_B1_POS_DONE = crypto.randomUUID();

const Layout = () => {
  // #region DBから取得する
  const [boards, setBoards] = useState<BoardInfo[]>([
    {
      id: crypto.randomUUID(),
      shortName: "board 1",
      title: "業務タスクboard 1",
      positions: [
        { id: SEED_B1_POS_TODO, name: "未処理" },
        { id: SEED_B1_POS_DOING, name: "処理中" },
        { id: SEED_B1_POS_DONE, name: "完了" },
      ],
      tasks: [
        {
          id: crypto.randomUUID(),
          name: "会議",
          comment: "あああ",
          importance: 2,
          deadline: new Date(2026, 6, 6),
          categoryId: SEED_CAT_SHANAI,
          positionId: SEED_B1_POS_TODO,
        },
        {
          id: crypto.randomUUID(),
          name: "メール",
          comment: "あああ",
          importance: 1,
          categoryId: SEED_CAT_PRIVATE,
          positionId: SEED_B1_POS_TODO,
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      shortName: "board 2",
      title: "業務タスクboard 2",
      positions: [
        { id: crypto.randomUUID(), name: "未処理" },
        { id: crypto.randomUUID(), name: "完了" },
      ],
      tasks: [],
    },
  ]);

  const [categories, setCategories] = useState<Category[]>([
    { id: SEED_CAT_SHANAI, name: "社内", color: "#5C6289" },
    { id: SEED_CAT_TORIHIKI, name: "取引先", color: "#5C8962" },
    { id: SEED_CAT_PRIVATE, name: "プライベート", color: "#895C5D" },
  ]);
  // #endregion

  // #region board情報変更・追加処理
  // タスクの保存(idが既存なら更新、無ければ追加)
  const handleSaveTask = (boardId: string, task: TaskInfo) => {
    setBoards((prev) =>
      prev.map((board) => {
        if (board.id !== boardId) return board;
        const tasks = board.tasks ?? [];
        const exists = tasks.some((t) => t.id === task.id);
        return {
          ...board,
          tasks: exists
            ? tasks.map((t) => (t.id === task.id ? task : t))
            : [...tasks, task],
        };
      }),
    );
  };

  const handleSetBoard = (id: string, updates: Partial<BoardInfo>) => {
    setBoards((prev) =>
      prev.map((board) => {
        if (board.id !== id) return board;
        const merged = { ...board, ...updates };

        // positionを編集した場合、消えたpositionに残るタスクは先頭positionへ退避
        if (updates.positions) {
          const validIds = new Set(updates.positions.map((p) => p.id));
          const fallbackId = updates.positions[0]?.id ?? "";
          merged.tasks = board.tasks?.map((task) =>
            validIds.has(task.positionId)
              ? task
              : { ...task, positionId: fallbackId },
          );
        }
        return merged;
      }),
    );
  };

  const handleCreateBoard = (
    title: string,
    shortName: string,
    positions: Position[],
  ) => {
    setBoards((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        shortName,
        title,
        positions,
        tasks: [],
      },
    ]);
  };

  const handleDeleteBoards = (ids: string[]) => {
    setBoards((prev) => prev.filter((board) => !ids.includes(board.id)));
  };
  // #endregion

  // #region タスクの並び替え・コンテナ間移動処理
  const handleReorderTasks = (boardId: string, tasks: TaskInfo[]) => {
    setBoards((prev) =>
      prev.map((board) => (board.id !== boardId ? board : { ...board, tasks })),
    );
  };
  // #endregion

  // #region タスクの一括削除
  const handleDeleteTasks = (boardId: string, taskIds: string[]) => {
    setBoards((prev) =>
      prev.map((board) =>
        board.id !== boardId
          ? board
          : {
              ...board,
              tasks: board.tasks?.filter((task) => !taskIds.includes(task.id)),
            },
      ),
    );
  };
  // #endregion

  // #region カテゴリー情報変更・追加処理
  const handleSetCategories = (
    categoryId: string,
    updates: Partial<Category>,
  ) => {
    setCategories((prev) =>
      prev.map((category) =>
        category.id !== categoryId ? category : { ...category, ...updates },
      ),
    );
  };

  const handleCreateCategory = (name: string, color: string) => {
    setCategories((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name, color },
    ]);
  };

  const handleDeleteCategories = (ids: string[]) => {
    setCategories((prev) =>
      prev.filter((category) => !ids.includes(category.id)),
    );
  };
  // #endretion

  const userInfo: UserInfo = {
    name: "山田花子",
    email: "hanako@example.com",
  };

  const [openingPageIndex, setOpeningPageIndex] = useState<number | null>(0);
  const [openSidebar, setOpenSidebar] = useState(true);
  const [openAIWindow, setOpenAIWindow] = useState(false);

  // AIウィンドウを開くときはサイドバーを閉じる
  const toggleAIWindow = () => {
    const willOpen = !openAIWindow;
    setOpenAIWindow(willOpen);
    if (willOpen) setOpenSidebar(false);
  };

  return (
    <div className="flex h-dvh overflow-hidden">
      <div className={openSidebar ? "w-45" : "w-10"}>
        <Sidebar
          boards={boards}
          openingPageIndex={openingPageIndex}
          isOpen={openSidebar}
          setOpeningPageIndex={setOpeningPageIndex}
          toggleSidebar={() => setOpenSidebar((prev) => !prev)}
        />
      </div>
      <div className="w-full flex flex-col min-w-0">
        <div>
          <Header
            title={
              openingPageIndex === null
                ? "ホーム画面"
                : boards[openingPageIndex].title
            }
          />
        </div>
        <div className="flex-1 overflow-x-auto">
          <Pages
            userInfo={userInfo}
            boards={boards}
            categories={categories}
            openingPageIndex={openingPageIndex}
            onSaveTask={handleSaveTask}
            onSetCategory={handleSetCategories}
            onCreateCategory={handleCreateCategory}
            onDeleteCategories={handleDeleteCategories}
            onSetBoard={handleSetBoard}
            onCreateBoard={handleCreateBoard}
            onDeleteBoards={handleDeleteBoards}
            onReorderTasks={handleReorderTasks}
            onDeleteTasks={handleDeleteTasks}
          />
        </div>
      </div>
      <div className={openAIWindow ? "w-70" : "w-10"}>
        <AI isOpen={openAIWindow} toggleAIWindow={toggleAIWindow} />
      </div>
    </div>
  );
};

export default Layout;
