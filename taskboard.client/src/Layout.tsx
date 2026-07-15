import { useEffect, useRef, useState } from "react";
import Header from "./features/header/index.tsx";
import Sidebar from "./features/sidebar/index.tsx";
import Pages from "./features/pages/index.tsx";
import AI from "./features/AI/index.tsx";
import ErrorScreen from "./components/ErrorScreen.tsx";
import { useBoards } from "./hooks/useBoards.ts";
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
    createCategory,
    setCategory,
    deleteCategories,
    getShareLink,
    joinBoard,
    leaveBoard,
  } = useBoards();
  const userInfo = useUser();

  // 初期表示はホーム画面（データ取得完了前に board を参照して落ちるのを防ぐ）
  const [openingPageIndex, setOpeningPageIndex] = useState<number | null>(null);
  const [openSidebar, setOpenSidebar] = useState(true);
  const [openAIWindow, setOpenAIWindow] = useState(false);
  // 以前は board 0 件で作成モーダルを自動表示していたが、共有ボードに「参加する」
  // ユーザー（作成しない）には邪魔なので廃止した。作成はホームの + から行う。

  // 共有リンク（?join=<token>）で開かれたら、そのボードに参加する。
  const handledJoin = useRef(false);
  useEffect(() => {
    if (handledJoin.current || !loaded) return;
    const token = new URLSearchParams(window.location.search).get("join");
    if (!token) return;
    handledJoin.current = true;
    // URL からトークンを消す（再読み込みで二重参加しないため）。
    window.history.replaceState(null, "", window.location.pathname);
    joinBoard(token);
  }, [loaded, joinBoard]);

  // 退出したら、そのボードを開いていたのでホーム画面へ戻す（インデックスがずれるため）。
  const handleLeaveBoard = async (boardId: string) => {
    const ok = await leaveBoard(boardId);
    if (ok) setOpeningPageIndex(null);
    return ok;
  };

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
            boardId={
              openingPageIndex === null
                ? undefined
                : boards[openingPageIndex]?.id
            }
          />
        </div>
        <div className="flex-1 min-h-0 overflow-x-auto">
          <Pages
            userInfo={userInfo}
            boards={boards}
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
            onGetShareLink={getShareLink}
            onJoinBoard={joinBoard}
            onLeaveBoard={handleLeaveBoard}
          />
        </div>
      </div>
      <div className={openAIWindow ? "w-90" : "w-10"}>
        <AI isOpen={openAIWindow} toggleAIWindow={toggleAIWindow} />
      </div>
    </div>
  );
};

export default Layout;
