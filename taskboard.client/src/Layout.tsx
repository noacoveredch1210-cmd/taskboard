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
import {
  loadBoardData,
  toCreateTaskRequest,
  toUpdateTaskRequest,
} from "./api/board-data.ts";
import { tasksApi } from "./api/tasks.ts";
import { boardsApi } from "./api/boards.ts";
import { categoriesApi } from "./api/categories.ts";
import { positionsApi } from "./api/positions.ts";

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

  // API 呼び出しの失敗をまとめてログするヘルパー(オプティミスティック更新なので握りつぶす)
  const reportError = (message: string) => (err: unknown) =>
    console.error(message, err);

  // #region board情報変更・追加処理
  // タスクの保存(idが既存なら更新[PUT]、無ければ追加[POST])
  const handleSaveTask = (boardId: string, task: TaskInfo) => {
    const board = boards.find((b) => b.id === boardId);
    const tasks = board?.tasks ?? [];
    const exists = tasks.some((t) => t.id === task.id);

    if (exists) {
      setBoards((prev) =>
        prev.map((b) =>
          b.id !== boardId
            ? b
            : { ...b, tasks: (b.tasks ?? []).map((t) => (t.id === task.id ? task : t)) },
        ),
      );
      tasksApi
        .update(task.id, toUpdateTaskRequest(task))
        .catch(reportError("タスクの更新に失敗しました"));
      return;
    }

    // 新規: 作成先カラムの末尾に来るよう order_index を採番する
    const columnTasks = tasks.filter((t) => t.positionId === task.positionId);
    const orderIndex = columnTasks.length
      ? Math.max(...columnTasks.map((t) => t.orderIndex)) + 1
      : 0;
    const newTask: TaskInfo = { ...task, orderIndex };

    setBoards((prev) =>
      prev.map((b) =>
        b.id !== boardId ? b : { ...b, tasks: [...(b.tasks ?? []), newTask] },
      ),
    );
    tasksApi
      .create(toCreateTaskRequest(newTask, boardId))
      .catch(reportError("タスクの作成に失敗しました"));
  };

  const handleSetBoard = (id: string, updates: Partial<BoardInfo>) => {
    const board = boards.find((b) => b.id === id);
    if (!board) return;

    // 消えた position に残るタスクは先頭 position へ退避する
    const validIds = updates.positions
      ? new Set(updates.positions.map((p) => p.id))
      : null;
    const fallbackId = updates.positions?.[0]?.id ?? "";

    // 退避対象を state 更新の前に確定しておく(更新関数内での副作用を避ける)
    const reassignedTasks: TaskInfo[] = validIds
      ? (board.tasks ?? [])
          .filter((task) => !validIds.has(task.positionId))
          .map((task) => ({ ...task, positionId: fallbackId }))
      : [];

    setBoards((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const merged = { ...b, ...updates };
        if (validIds) {
          merged.tasks = b.tasks?.map((task) =>
            validIds.has(task.positionId)
              ? task
              : { ...task, positionId: fallbackId },
          );
        }
        return merged;
      }),
    );

    // --- API 反映 ---
    // board 本体
    boardsApi
      .update(id, {
        shortName: updates.shortName ?? board.shortName,
        title: updates.title ?? board.title,
      })
      .catch(reportError("boardの更新に失敗しました"));

    if (updates.positions) {
      const oldIds = new Set(board.positions.map((p) => p.id));
      const newIds = new Set(updates.positions.map((p) => p.id));

      // 退避したタスクを先に付け替え(position 削除より前。FK 制約対策)
      reassignedTasks.forEach((task) =>
        tasksApi
          .update(task.id, toUpdateTaskRequest(task))
          .catch(reportError("タスクの付け替えに失敗しました")),
      );

      // 追加 / 名前・並び順の更新
      updates.positions.forEach((p, index) => {
        if (oldIds.has(p.id)) {
          positionsApi
            .update(p.id, { name: p.name, orderIndex: index })
            .catch(reportError("positionの更新に失敗しました"));
        } else {
          positionsApi
            .create({ id: p.id, boardId: id, name: p.name, orderIndex: index })
            .catch(reportError("positionの作成に失敗しました"));
        }
      });

      // 削除
      board.positions
        .filter((p) => !newIds.has(p.id))
        .forEach((p) =>
          positionsApi
            .remove(p.id)
            .catch(reportError("positionの削除に失敗しました")),
        );
    }
  };

  const handleCreateBoard = (
    title: string,
    shortName: string,
    positions: Position[],
  ) => {
    const boardId = crypto.randomUUID();
    setBoards((prev) => [
      ...prev,
      { id: boardId, shortName, title, positions, tasks: [] },
    ]);

    boardsApi
      .create({ id: boardId, userId: CURRENT_USER_ID, shortName, title })
      .then(() =>
        Promise.all(
          positions.map((p, index) =>
            positionsApi.create({
              id: p.id,
              boardId,
              name: p.name,
              orderIndex: index,
            }),
          ),
        ),
      )
      .catch(reportError("boardの作成に失敗しました"));
  };

  const handleDeleteBoards = (ids: string[]) => {
    setBoards((prev) => prev.filter((board) => !ids.includes(board.id)));
    ids.forEach((id) =>
      boardsApi.remove(id).catch(reportError("boardの削除に失敗しました")),
    );
  };
  // #endregion

  // #region タスクの並び替え・コンテナ間移動処理
  // ドラッグ中(dragOver)のライブ反映。state のみ更新し、DB 保存はしない
  const handleReorderTasks = (boardId: string, tasks: TaskInfo[]) => {
    setBoards((prev) =>
      prev.map((board) => (board.id !== boardId ? board : { ...board, tasks })),
    );
  };

  // 移動したタスクの新しい order_index を「移動先の両隣の中間値」で決める。
  // 分数(double)を使うことで、更新は動かした 1 件だけで済む。
  // 中間値が浮動小数の精度で表現できない(枯渇した)場合は null を返す → 呼び出し側でリバランス。
  const nextOrderIndex = (
    column: TaskInfo[],
    at: number,
  ): number | null => {
    const prev = column[at - 1];
    const next = column[at + 1];

    if (prev && next) {
      const mid = (prev.orderIndex + next.orderIndex) / 2;
      // 精度が尽きると mid が両隣と一致してしまう。その時は null(要リバランス)
      return mid > prev.orderIndex && mid < next.orderIndex ? mid : null;
    }
    if (next) return next.orderIndex - 1; // 先頭へ
    if (prev) return prev.orderIndex + 1; // 末尾へ
    return 0; // カラムに 1 件だけ
  };

  // 安全網: 分数が枯渇したカラムだけ order_index を 0,1,2,… に振り直して全件保存する。
  // 通常は発動せず、同じ2件の間へ数十回挿入し続けた時のみ通る。
  const rebalanceColumn = (
    boardId: string,
    allTasks: TaskInfo[],
    column: TaskInfo[],
  ) => {
    const renumbered = new Map(column.map((t, i) => [t.id, i]));
    const nextTasks = allTasks.map((t) => {
      const index = renumbered.get(t.id);
      return index === undefined ? t : { ...t, orderIndex: index };
    });

    setBoards((prev) =>
      prev.map((board) =>
        board.id !== boardId ? board : { ...board, tasks: nextTasks },
      ),
    );
    // このカラムの全件を保存(この分岐はまれ)
    column.forEach((t, i) =>
      tasksApi
        .update(t.id, toUpdateTaskRequest({ ...t, orderIndex: i }))
        .catch(reportError("並び順の再整列に失敗しました")),
    );
  };

  // 並び替えの確定(dragEnd 等)。動いた 1 件だけ order_index を計算して DB へ保存する
  const handleCommitTaskMove = (
    boardId: string,
    movedTaskId: string,
    tasks: TaskInfo[],
  ) => {
    const moved = tasks.find((t) => t.id === movedTaskId);
    if (!moved) return;

    const column = tasks.filter((t) => t.positionId === moved.positionId);
    const at = column.findIndex((t) => t.id === movedTaskId);
    const orderIndex = nextOrderIndex(column, at);

    // 中間値が枯渇していたら、このカラムを振り直して終わり(安全網)
    if (orderIndex === null) {
      rebalanceColumn(boardId, tasks, column);
      return;
    }

    const updated: TaskInfo = { ...moved, orderIndex };
    setBoards((prev) =>
      prev.map((board) =>
        board.id !== boardId
          ? board
          : {
              ...board,
              tasks: tasks.map((t) => (t.id === movedTaskId ? updated : t)),
            },
      ),
    );
    tasksApi
      .update(movedTaskId, toUpdateTaskRequest(updated))
      .catch(reportError("タスクの並び順の保存に失敗しました"));
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
    taskIds.forEach((id) =>
      tasksApi.remove(id).catch(reportError("タスクの削除に失敗しました")),
    );
  };
  // #endregion

  // #region カテゴリー情報変更・追加処理
  const handleSetCategories = (
    categoryId: string,
    updates: Partial<Category>,
  ) => {
    const current = categories.find((c) => c.id === categoryId);
    if (!current) return;
    const merged = { ...current, ...updates };

    setCategories((prev) =>
      prev.map((category) =>
        category.id !== categoryId ? category : merged,
      ),
    );
    categoriesApi
      .update(categoryId, { name: merged.name, color: merged.color })
      .catch(reportError("カテゴリーの更新に失敗しました"));
  };

  const handleCreateCategory = (name: string, color: string) => {
    const id = crypto.randomUUID();
    setCategories((prev) => [...prev, { id, name, color }]);
    categoriesApi
      .create({ id, userId: CURRENT_USER_ID, name, color })
      .catch(reportError("カテゴリーの作成に失敗しました"));
  };

  const handleDeleteCategories = (ids: string[]) => {
    setCategories((prev) =>
      prev.filter((category) => !ids.includes(category.id)),
    );
    ids.forEach((id) =>
      categoriesApi.remove(id).catch(reportError("カテゴリーの削除に失敗しました")),
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
            onCommitTaskMove={handleCommitTaskMove}
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
