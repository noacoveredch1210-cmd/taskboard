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

    // 新規: order_index は採番しない。サーバーが「そのカラムの最小値 - 1」を振り、先頭へ入れる。
    // ここで計算しないのは、移動や振り直しの後、クライアントが持つ order_index が
    // 古くなっているため（古い値から採番すると、意図しない位置に入る）。
    // 表示順は配列順なので、state では先頭へ入れれば再取得を待たずに先頭に出せる。
    setBoards((prev) =>
      prev.map((b) =>
        b.id !== boardId ? b : { ...b, tasks: [task, ...(b.tasks ?? [])] },
      ),
    );
    tasksApi
      .create(toCreateTaskRequest(task, boardId))
      .catch(handleFailure("タスクの作成に失敗しました", boards));
  };
  // #endregion

  // #region board の編集
  const setBoard = (id: string, updates: Partial<BoardInfo>) => {
    const board = boards.find((b) => b.id === id);
    if (!board) return;

    // 消えた position に残るタスクは先頭 position へ退避する。
    // サーバーも同じことを（同じトランザクションの中で）やるが、こちらは表示を
    // 即座に整えるため。再取得を待つと、タスクが一瞬どこにも属さず消えて見える。
    const validIds = updates.positions
      ? new Set(updates.positions.map((p) => p.id))
      : null;
    const fallbackId = updates.positions?.[0]?.id ?? "";

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
    // 列は「あるべき姿」を丸ごと送り、追加・改名・並べ替え・削除・タスクの退避は
    // サーバーが 1 トランザクションで行う。以前はここから列とタスクへ個別のリクエストを
    // 並べて投げていたが、途中で失敗すると「列は消えたのにタスクの退避は済んでいない」
    // といった中途半端な状態がサーバーに残った（順序も await していないので保証が無かった）。
    boardsApi
      .update(id, {
        shortName: updates.shortName ?? board.shortName,
        title: updates.title ?? board.title,
        positions: updates.positions?.map((p) => ({ id: p.id, name: p.name })),
      })
      .catch(handleFailure("boardの更新に失敗しました", boards));
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

  /**
   * 並び替えの確定(dragEnd 等)。
   *
   * order_index は計算しない。「移動先の両隣は誰か」だけを送り、採番はサーバーに任せる
   * （中間値の枯渇と振り直しも、サーバーが 1 トランザクションで面倒を見る）。
   * かつてはここで中間値を計算し、枯渇時はカラム全件を個別に PUT していたが、
   * その振り直しは原子的でなく、途中で失敗すると一部だけ新しい連番・残りは古い密集値、
   * という並び順が壊れた状態がサーバーに残った。
   *
   * 表示順は配列順なので、クライアントは order_index の値を知らなくても描画できる。
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

    // 移動後のカラムでの両隣を、サーバーへ伝える「意図」にする。
    const column = tasks.filter((t) => t.positionId === moved.positionId);
    const at = column.findIndex((t) => t.id === movedTaskId);

    setBoards((prev) =>
      prev.map((board) =>
        board.id !== boardId ? board : { ...board, tasks },
      ),
    );
    tasksApi
      .move(movedTaskId, {
        positionId: moved.positionId || null,
        prevTaskId: column[at - 1]?.id ?? null,
        nextTaskId: column[at + 1]?.id ?? null,
      })
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
