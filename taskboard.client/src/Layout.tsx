import { useEffect, useRef, useState } from "react";
import Header from "./features/header/index";
import Sidebar from "./features/sidebar/index";
import Pages from "./features/pages/index";
import AI from "./features/AI/index";
import ErrorScreen from "./components/ErrorScreen";
import { useBoards } from "./hooks/useBoards";
import { useUser } from "./hooks/useUser";
import Loading from "./components/Loading";
import type { Position } from "./types/position";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";

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
    restoreTask,
  } = useBoards();
  const userInfo = useUser();

  // 初期表示はホーム画面（データ取得完了前に board を参照して落ちるのを防ぐ）
  const [openingPageIndex, setOpeningPageIndex] = useState<number | null>(null);
  const [openSidebar, setOpenSidebar] = useState(true);
  const [openAIWindow, setOpenAIWindow] = useState(true);
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

  // ボードを作ったら、そのまま作成したボードを開く（新規 board は末尾に追加される）。
  const handleCreateBoard = (
    title: string,
    shortName: string,
    positions: Position[],
  ) => {
    createBoard(title, shortName, positions);
    setOpeningPageIndex(boards.length);
  };

  // AIウィンドウを開くときはサイドバーを閉じる
  const aiPanelRef = usePanelRef();

  const toggleAIWindow = () => {
    const panel = aiPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }
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

      <Group orientation="horizontal" className="flex-1 min-w-0">
        <Panel defaultSize="75%" minSize="30%">
          <div className="h-full flex flex-col min-w-0">
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
                onCreateBoard={handleCreateBoard}
                onDeleteBoards={deleteBoards}
                onReorderTasks={reorderTasks}
                onCommitTaskMove={commitTaskMove}
                onDeleteTasks={deleteTasks}
                onGetShareLink={getShareLink}
                onJoinBoard={joinBoard}
                onLeaveBoard={handleLeaveBoard}
                onRestoreTask={restoreTask}
              />
            </div>
          </div>
        </Panel>

        <Separator className="w-1 bg-gray-200 hover:bg-primary transition-colors" />

        <Panel
          panelRef={aiPanelRef}
          defaultSize="35%"
          minSize="15%"
          maxSize="45%"
          collapsible
          collapsedSize="4%"
          onResize={() => {
            const panel = aiPanelRef.current;
            if (panel) setOpenAIWindow(!panel.isCollapsed());
          }}
        >
          <AI isOpen={openAIWindow} toggleAIWindow={toggleAIWindow} />
        </Panel>
      </Group>
    </div>
  );
};

export default Layout;
