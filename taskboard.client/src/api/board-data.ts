// サーバーのフラットな DTO 群を取得し、クライアント UI が使うネスト構造
// （BoardInfo に positions / tasks を内包）へ組み立てるローダー。

import { usersApi } from "./users";
import { boardsApi } from "./boards";
import { tasksApi } from "./tasks";
import { categoriesApi } from "./categories";
import { positionsApi } from "./positions";
import type { BoardDto, TaskDto, CategoryDto, PositionDto, UserDto } from "./types";

import type { UserInfo } from "../types/userInfo";
import type { BoardInfo } from "../types/boardInfo";
import type { Category } from "../types/category";
import type { TaskInfo } from "../types/taskInfo";
import type { Position } from "../types/position";

/** loadBoardData がまとめて返す、UI 用に整形済みの初期データ */
export type BoardData = {
  user: UserInfo;
  boards: BoardInfo[];
  categories: Category[];
};

/**
 * 指定ユーザーの画面表示に必要なデータを一括取得して UI 型へ変換する。
 * user / boards / categories を並列取得し、board ごとに positions / tasks を並列取得する。
 */
export const loadBoardData = async (userId: string): Promise<BoardData> => {
  const [user, boardDtos, categoryDtos] = await Promise.all([
    usersApi.getById(userId),
    boardsApi.getByUser(userId),
    categoriesApi.getByUser(userId),
  ]);

  const boards = await Promise.all(
    boardDtos.map(async (board) => {
      const [positions, tasks] = await Promise.all([
        positionsApi.getByBoard(board.id),
        tasksApi.getByBoard(board.id),
      ]);
      return toBoardInfo(board, positions, tasks);
    }),
  );

  return {
    user: toUserInfo(user),
    boards,
    categories: categoryDtos.map(toCategory),
  };
};

// ---- DTO → UI 型 マッパー ----

const toUserInfo = (dto: UserDto): UserInfo => {
  return { name: dto.name, email: dto.email };
};

const toCategory = (dto: CategoryDto): Category => {
  return { id: dto.id, name: dto.name, color: dto.color };
};

const toPosition = (dto: PositionDto): Position => {
  return { id: dto.id, name: dto.name };
};

const toBoardInfo = (
  board: BoardDto,
  positions: PositionDto[],
  tasks: TaskDto[],
): BoardInfo => {
  return {
    id: board.id,
    shortName: board.shortName,
    title: board.title,
    positions: positions.map(toPosition),
    tasks: tasks.map(toTaskInfo),
  };
};

const toTaskInfo = (dto: TaskDto): TaskInfo => {
  return {
    id: dto.id,
    name: dto.name,
    comment: dto.comment ?? "",
    importance: dto.importance ?? 0,
    deadline: dto.deadline ? parseDateOnly(dto.deadline) : undefined,
    // 未設定は空文字（既存 UI の規約に合わせる）
    categoryId: dto.categoryId ?? "",
    positionId: dto.positionId ?? "",
  };
};

/** "YYYY-MM-DD" をローカルタイムの Date として解釈する（UTC 解釈による日ズレを防ぐ） */
const parseDateOnly = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};
