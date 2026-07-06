import { useEffect, useState } from "react";
import Header from "./features/header/index.tsx";
import Sidebar from "./features/sidebar/index.tsx";
import Pages from "./features/pages/index.tsx";
import AI from "./features/AI/index.tsx";
import type { BoardInfo } from "./types/boardInfo.ts";
import type { UserInfo } from "./types/userInfo.ts";
import type { Category } from "./types/category.ts";
import type { TaskInfo } from "./types/taskInfo.ts";
import type { Position } from "./types/position.ts";
import { loadBoardData } from "./api/board-data.ts";

// 取得対象ユーザーの ID（テスト用に固定。実運用では認証結果などから決定する）
// TODO: DB に存在する実ユーザーの GUID に置き換える
const CURRENT_USER_ID = "3afa0a01-8a0b-45b4-a4d6-e61a654d1c48";

const Layout = () => {
  // #region DBから取得する
  const [boards, setBoards] = useState<BoardInfo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo>({ name: "", email: "" });

  // マウント時に API から初期データを取得して state に反映する
  useEffect(() => {
    loadBoardData(CURRENT_USER_ID)
      .then((data) => {
        setBoards(data.boards);
        setCategories(data.categories);
        setUserInfo(data.user);
      })
      .catch((err) => {
        console.error("初期データの取得に失敗しました", err);
      });
  }, []);
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

  // 初期表示はホーム画面（データ取得完了前に board を参照して落ちるのを防ぐ）
  const [openingPageIndex, setOpeningPageIndex] = useState<number | null>(null);
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
                : (boards[openingPageIndex]?.title ?? "")
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
