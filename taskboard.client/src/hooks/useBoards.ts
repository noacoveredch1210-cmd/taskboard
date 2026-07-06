import { useEffect, useState } from "react";
import {
  loadBoards,
  toCreateTaskRequest,
  toUpdateTaskRequest,
} from "../api/board-data";
import { tasksApi } from "../api/tasks";
import { boardsApi } from "../api/boards";
import { positionsApi } from "../api/positions";
import { reportError } from "./reportError";
import type { BoardInfo } from "../types/boardInfo";
import type { TaskInfo } from "../types/taskInfo";
import type { Position } from "../types/position";

/**
 * board / task / position の状態管理と API 連携をまとめたフック。
 * すべてオプティミスティック更新（即 state 反映 → API 送信 → 失敗はログ）。
 */
export const useBoards = (userId: string) => {
  const [boards, setBoards] = useState<BoardInfo[]>([]);

  // マウント時に API から board 一覧を取得する
  useEffect(() => {
    loadBoards(userId)
      .then(setBoards)
      .catch(reportError("boardの取得に失敗しました"));
  }, [userId]);

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

  const createBoard = (
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
      .create({ id: boardId, userId, shortName, title })
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

  const deleteBoards = (ids: string[]) => {
    setBoards((prev) => prev.filter((board) => !ids.includes(board.id)));
    ids.forEach((id) =>
      boardsApi.remove(id).catch(reportError("boardの削除に失敗しました")),
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
        .catch(reportError("並び順の再整列に失敗しました")),
    );
  };

  // 並び替えの確定(dragEnd 等)。動いた 1 件だけ order_index を計算して DB へ保存する
  const commitTaskMove = (
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
      tasksApi.remove(id).catch(reportError("タスクの削除に失敗しました")),
    );
  };
  // #endregion

  return {
    boards,
    saveTask,
    setBoard,
    createBoard,
    deleteBoards,
    reorderTasks,
    commitTaskMove,
    deleteTasks,
  };
};
