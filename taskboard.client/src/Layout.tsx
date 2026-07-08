import { useEffect, useRef, useState } from "react";
import Header from "./features/header/index.tsx";
import Sidebar from "./features/sidebar/index.tsx";
import Pages from "./features/pages/index.tsx";
import AI from "./features/AI/index.tsx";
import BoardModal from "./features/pages/components/home/board/BoardModal.tsx";
import ErrorScreen from "./components/ErrorScreen.tsx";
import { useBoards } from "./hooks/useBoards.ts";
import { useCategories } from "./hooks/useCategories.ts";
import { useUser } from "./hooks/useUser.ts";
import Loading from "./components/Loading.tsx";

const Layout = () => {
  // データ取得・更新はフックに委譲(いずれもオプティミスティック更新)。
  // 対象ユーザーは API 側で認証トークン(JWT)から決定されるため ID は渡さない。
  const {
    boards,
    loaded,
    error,
    saveTask,
    setBoard,
    createBoard,
    deleteBoards,
    reorderTasks,
    commitTaskMove,
    deleteTasks,
  } = useBoards();
  const { categories, setCategory, createCategory, deleteCategories } =
    useCategories();
  const userInfo = useUser();

  // 初期表示はホーム画面（データ取得完了前に board を参照して落ちるのを防ぐ）
  const [openingPageIndex, setOpeningPageIndex] = useState<number | null>(null);
  const [openSidebar, setOpenSidebar] = useState(true);
  const [openAIWindow, setOpenAIWindow] = useState(false);

  // board が1件も無いユーザー向けに、初回ロード完了時だけ board 追加モーダルを自動表示する。
  const [showFirstBoardModal, setShowFirstBoardModal] = useState(false);
  const promptedFirstBoard = useRef(false);
  useEffect(() => {
    if (!promptedFirstBoard.current && loaded && boards.length === 0) {
      promptedFirstBoard.current = true;
      setShowFirstBoardModal(true);
    }
  }, [loaded, boards.length]);

  // AIウィンドウを開くときはサイドバーを閉じる
  const toggleAIWindow = () => {
    const willOpen = !openAIWindow;
    setOpenAIWindow(willOpen);
    if (willOpen) setOpenSidebar(false);
  };

  // 初期取得に失敗したら、アプリ本体の代わりにエラー画面を表示する
  if (error) return <ErrorScreen onRetry={() => window.location.reload()} />;

  // 初期ロード中はロード画面を出す
  if (!loaded) return <Loading />;

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
      {showFirstBoardModal && (
        <BoardModal
          onClose={() => setShowFirstBoardModal(false)}
          onCreateBoard={createBoard}
        />
      )}
    </div>
  );
};

export default Layout;
