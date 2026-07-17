import { useEffect, useState } from "react";
import {
  loadBoards,
  toCreateTaskRequest,
  toUpdateTaskRequest,
} from "../api/board-data";
import { tasksApi } from "../api/tasks";
import { boardsApi } from "../api/boards";
import { positionsApi } from "../api/positions";
import { categoriesApi } from "../api/categories";
import { reportError } from "./reportError";
import { useToast } from "../components/toast/ToastContext";
import type { BoardInfo } from "../types/boardInfo";
import type { TaskInfo } from "../types/taskInfo";
import type { Position } from "../types/position";
import type { Category } from "../types/category";

/**
 * board / task / position の状態管理と API 連携をまとめたフック。
 * すべてオプティミスティック更新（即 state 反映 → API 送信 → 失敗したら巻き戻す）。
 */
export const useBoards = () => {
  const [boards, setBoards] = useState<BoardInfo[]>([]);
  // 初回ロード完了フラグ（空配列の初期状態と「ロード後に本当に0件」を区別する）
  const [loaded, setLoaded] = useState(false);
  // 初回取得に失敗したか（true のときは呼び出し側でエラー画面を出す）
  const [error, setError] = useState(false);
  const { showToast } = useToast();

  // マウント時に API から board 一覧を取得する
  useEffect(() => {
    loadBoards()
      .then(setBoards)
      .catch((e) => {
        setError(true);
        reportError("boardの取得に失敗しました")(e);
      })
      .finally(() => setLoaded(true));
  }, []);

  /**
   * 楽観的更新に対応する API 呼び出しが失敗したときの後始末。
   * 失敗を通知したうえで、サーバーを真として board 一覧を取り直す。
   *
   * 逆操作を書いて巻き戻さないのは、setBoard のように複数の API を並列に投げる操作では
   * 「どこまで成功したか」で正しい逆操作が変わり、部分的な失敗で状態がずれるため。
   * 取り直せば、どの経路で失敗しても必ずサーバーの状態に収束する。
   *
   * その再取得すら失敗した場合（通信断など）は、操作前の snapshot へ戻す。
   * 取り直せないほど通信が切れているなら更新もサーバーに届いていないため、
   * 操作前の state がサーバーの状態と一致しているとみなせる。
   *
   * @param snapshot 楽観的更新を適用する前の boards
   */
  const handleFailure =
    (message: string, snapshot: BoardInfo[]) => (err: unknown) => {
      reportError(message)(err);
      showToast(message);
      loadBoards()
        .then(setBoards)
        .catch((refetchError) => {
          reportError("最新の状態を取得できませんでした")(refetchError);
          setBoards(snapshot);
        });
    };

  // #region タスクの保存(idが既存なら更新[PUT]、無ければ追加[POST])
  const saveTask = (boardId: string, task: TaskInfo) => {
    const board = boards.find((b) => b.id === boardId);
    const tasks = board?.tasks ?? [];
    const exists = tasks.some((t) => t.id === task.id);

    if (exists) {
      setBoards((prev) =>
        prev.map((b) =>
          b.id !== boardId
            ? b
            : {
                ...b,
                tasks: (b.tasks ?? []).map((t) => (t.id === task.id ? task : t)),
              },
        ),
      );
      tasksApi
        .update(task.id, toUpdateTaskRequest(task))
        .catch(handleFailure("タスクの更新に失敗しました", boards));
      return;
    }

    // 新規: 作成先カラムの先頭に来るよう order_index を採番する。
    // サーバーは order_index の昇順で返すので、最小値より小さい値を振る。
    const columnTasks = tasks.filter((t) => t.positionId === task.positionId);
    const orderIndex = columnTasks.length
      ? Math.min(...columnTasks.map((t) => t.orderIndex)) - 1
      : 0;
    const newTask: TaskInfo = { ...task, orderIndex };

    // 表示順は配列順なので、state でも先頭へ入れる（再取得を待たずに先頭へ出す）
    setBoards((prev) =>
      prev.map((b) =>
        b.id !== boardId ? b : { ...b, tasks: [newTask, ...(b.tasks ?? [])] },
      ),
    );
    tasksApi
      .create(toCreateTaskRequest(newTask, boardId))
      .catch(handleFailure("タスクの作成に失敗しました", boards));
  };
  // #endregion

  // #region board の編集
  const setBoard = (id: string, updates: Partial<BoardInfo>) => {
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
    boardsApi
      .update(id, {
        shortName: updates.shortName ?? board.shortName,
        title: updates.title ?? board.title,
      })
      .catch(handleFailure("boardの更新に失敗しました", boards));

    if (updates.positions) {
      const oldIds = new Set(board.positions.map((p) => p.id));
      const newIds = new Set(updates.positions.map((p) => p.id));

      // 退避したタスクを先に付け替え(position 削除より前。FK 制約対策)
      reassignedTasks.forEach((task) =>
        tasksApi
          .update(task.id, toUpdateTaskRequest(task))
          .catch(handleFailure("タスクの付け替えに失敗しました", boards)),
      );

      // 追加 / 名前・並び順の更新
      updates.positions.forEach((p, index) => {
        if (oldIds.has(p.id)) {
          positionsApi
            .update(p.id, { name: p.name, orderIndex: index })
            .catch(handleFailure("positionの更新に失敗しました", boards));
        } else {
          positionsApi
            .create({ id: p.id, boardId: id, name: p.name, orderIndex: index })
            .catch(handleFailure("positionの作成に失敗しました", boards));
        }
      });

      // 削除
      board.positions
        .filter((p) => !newIds.has(p.id))
        .forEach((p) =>
          positionsApi
            .remove(p.id)
            .catch(handleFailure("positionの削除に失敗しました", boards)),
        );
    }
  };

  const createBoard = (
    title: string,
    shortName: string,
    positions: Position[],
  ) => {
    const boardId = crypto.randomUUID();
    setBoards((prev) => [
      ...prev,
      // 作成者は owner。カテゴリーは空で始まる。
      { id: boardId, shortName, title, role: "owner", positions, categories: [], tasks: [] },
    ]);

    boardsApi
      .create({ id: boardId, shortName, title })
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
      .catch(handleFailure("boardの作成に失敗しました", boards));
  };

  const deleteBoards = (ids: string[]) => {
    setBoards((prev) => prev.filter((board) => !ids.includes(board.id)));
    ids.forEach((id) =>
      boardsApi.remove(id).catch(handleFailure("boardの削除に失敗しました", boards)),
    );
  };
  // #endregion

  // #region タスクの並び替え・コンテナ間移動
  // ドラッグ中(dragOver)のライブ反映。state のみ更新し、DB 保存はしない
  const reorderTasks = (boardId: string, tasks: TaskInfo[]) => {
    setBoards((prev) =>
      prev.map((board) => (board.id !== boardId ? board : { ...board, tasks })),
    );
  };

  // 移動したタスクの新しい order_index を「移動先の両隣の中間値」で決める。
  // 中間値が浮動小数の精度で表現できない(枯渇した)場合は null を返す → 呼び出し側でリバランス。
  const nextOrderIndex = (column: TaskInfo[], at: number): number | null => {
    const prev = column[at - 1];
    const next = column[at + 1];

    if (prev && next) {
      const mid = (prev.orderIndex + next.orderIndex) / 2;
      return mid > prev.orderIndex && mid < next.orderIndex ? mid : null;
    }
    if (next) return next.orderIndex - 1; // 先頭へ
    if (prev) return prev.orderIndex + 1; // 末尾へ
    return 0; // カラムに 1 件だけ
  };

  // 安全網: 分数が枯渇したカラムだけ order_index を 0,1,2,… に振り直して全件保存する。
  const rebalanceColumn = (
    boardId: string,
    allTasks: TaskInfo[],
    column: TaskInfo[],
    snapshot: BoardInfo[],
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
    column.forEach((t, i) =>
      tasksApi
        .update(t.id, toUpdateTaskRequest({ ...t, orderIndex: i }))
        .catch(handleFailure("並び順の再整列に失敗しました", snapshot)),
    );
  };

  /**
   * 並び替えの確定(dragEnd 等)。動いた 1 件だけ order_index を計算して DB へ保存する。
   *
   * @param tasks 移動後のタスク配列
   * @param tasksBeforeMove 移動前のタスク配列。巻き戻し用のスナップショットに使う。
   *   ドラッグ中は reorderTasks が state をライブ更新しているため、
   *   このフックが持つ boards は既に移動後になっており、そのままでは巻き戻せない。
   */
  const commitTaskMove = (
    boardId: string,
    movedTaskId: string,
    tasks: TaskInfo[],
    tasksBeforeMove: TaskInfo[],
  ) => {
    const moved = tasks.find((t) => t.id === movedTaskId);
    if (!moved) return;

    const snapshot = boards.map((board) =>
      board.id !== boardId ? board : { ...board, tasks: tasksBeforeMove },
    );

    const column = tasks.filter((t) => t.positionId === moved.positionId);
    const at = column.findIndex((t) => t.id === movedTaskId);
    const orderIndex = nextOrderIndex(column, at);

    // 中間値が枯渇していたら、このカラムを振り直して終わり(安全網)
    if (orderIndex === null) {
      rebalanceColumn(boardId, tasks, column, snapshot);
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
      .catch(handleFailure("タスクの並び順の保存に失敗しました", snapshot));
  };
  // #endregion

  // #region タスクの一括削除
  const deleteTasks = (boardId: string, taskIds: string[]) => {
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
      tasksApi.remove(id).catch(handleFailure("タスクの削除に失敗しました", boards)),
    );
  };

  /**
   * ゴミ箱から復元したタスクを、対象ボードの一覧へ楽観的に戻す。
   * ゴミ箱モーダルが持つタスク情報を受け取り、state に足しつつ API を呼ぶ。
   */
  const restoreTask = async (
    boardId: string,
    restored: TaskInfo,
  ): Promise<boolean> => {
    setBoards((prev) =>
      prev.map((board) =>
        board.id !== boardId
          ? board
          : { ...board, tasks: [...(board.tasks ?? []), restored] },
      ),
    );
    try {
      await tasksApi.restore(restored.id);
      return true;
    } catch (e) {
      handleFailure("タスクの復元に失敗しました", boards)(e);
      return false;
    }
  };
  // #endregion

  // #region カテゴリー（ボード単位）
  /** 指定ボードの categories を差し替える小さなヘルパー。 */
  const patchCategories = (
    boardId: string,
    update: (current: Category[]) => Category[],
  ) =>
    setBoards((prev) =>
      prev.map((board) =>
        board.id !== boardId
          ? board
          : { ...board, categories: update(board.categories) },
      ),
    );

  const createCategory = (boardId: string, name: string, color: string) => {
    const id = crypto.randomUUID();
    patchCategories(boardId, (categories) => [...categories, { id, name, color }]);
    categoriesApi
      .create({ id, boardId, name, color })
      .catch(handleFailure("カテゴリーの作成に失敗しました", boards));
  };

  const setCategory = (
    boardId: string,
    categoryId: string,
    updates: Partial<Category>,
  ) => {
    const board = boards.find((b) => b.id === boardId);
    const current = board?.categories.find((c) => c.id === categoryId);
    if (!current) return;
    const merged = { ...current, ...updates };

    patchCategories(boardId, (categories) =>
      categories.map((c) => (c.id === categoryId ? merged : c)),
    );
    categoriesApi
      .update(categoryId, { name: merged.name, color: merged.color })
      .catch(handleFailure("カテゴリーの更新に失敗しました", boards));
  };

  const deleteCategories = (boardId: string, ids: string[]) => {
    patchCategories(boardId, (categories) =>
      categories.filter((c) => !ids.includes(c.id)),
    );
    ids.forEach((id) =>
      categoriesApi
        .remove(id)
        .catch(handleFailure("カテゴリーの削除に失敗しました", boards)),
    );
  };
  // #endregion

  // #region 共有
  /** 共有トークンを取得し、参加用の URL を組み立てて返す（オーナーのみ）。 */
  const getShareLink = async (boardId: string): Promise<string> => {
    const token = await boardsApi.getShareToken(boardId);
    return `${window.location.origin}/?join=${token}`;
  };

  /**
   * 共有トークンで参加リクエストを出す（承認制）。
   * 既にメンバーなら一覧を取り直して "member" を返す。承認待ちなら "requested"。失敗なら null。
   */
  const joinBoard = async (
    token: string,
  ): Promise<"member" | "requested" | null> => {
    try {
      const res = await boardsApi.join(token);
      if (res.status === "member") {
        const fresh = await loadBoards();
        setBoards(fresh);
        showToast("すでに参加しているボードです。");
        return "member";
      }
      showToast(
        "参加リクエストを送信しました。オーナーの承認をお待ちください。",
      );
      return "requested";
    } catch (e) {
      reportError("ボードへの参加に失敗しました")(e);
      showToast("ボードに参加できませんでした。リンクを確認してください。");
      return null;
    }
  };

  /** このボードから退出する。成功したら一覧から取り除く。オーナーは退出できない。 */
  const leaveBoard = async (boardId: string): Promise<boolean> => {
    try {
      await boardsApi.leave(boardId);
      setBoards((prev) => prev.filter((b) => b.id !== boardId));
      showToast("ボードから退出しました。");
      return true;
    } catch (e) {
      reportError("ボードからの退出に失敗しました")(e);
      showToast("ボードから退出できませんでした。");
      return false;
    }
  };
  // #endregion

  return {
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
  };
};
