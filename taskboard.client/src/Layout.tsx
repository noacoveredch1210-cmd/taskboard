import { useState } from "react";
import Header from "./features/header/index.tsx";
import Sidebar from "./features/sidebar/index.tsx";
import Pages from "./features/pages/index.tsx";
import AI from "./features/AI/index.tsx";
import { useBoards } from "./hooks/useBoards.ts";
import { useCategories } from "./hooks/useCategories.ts";
import { useUser } from "./hooks/useUser.ts";

// 取得対象ユーザーの ID（テスト用に固定。実運用では認証結果などから決定する）
// TODO: DB に存在する実ユーザーの GUID に置き換える
const CURRENT_USER_ID = "3afa0a01-8a0b-45b4-a4d6-e61a654d1c48";

const Layout = () => {
  // データ取得・更新はフックに委譲(いずれもオプティミスティック更新)
  const {
    boards,
    saveTask,
    setBoard,
    createBoard,
    deleteBoards,
    reorderTasks,
    commitTaskMove,
    deleteTasks,
  } = useBoards(CURRENT_USER_ID);
  const { categories, setCategory, createCategory, deleteCategories } =
    useCategories(CURRENT_USER_ID);
  const userInfo = useUser(CURRENT_USER_ID);

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
            onSaveTask={saveTask}
            onSetCategory={setCategory}
            onCreateCategory={createCategory}
            onDeleteCategories={deleteCategories}
            onSetBoard={setBoard}
            onCreateBoard={createBoard}
            onDeleteBoards={deleteBoards}
            onReorderTasks={reorderTasks}
            onCommitTaskMove={commitTaskMove}
            onDeleteTasks={deleteTasks}
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
