// サーバーのフラットな DTO 群を取得し、クライアント UI が使うネスト構造
// （BoardInfo に positions / tasks を内包）へ組み立てるローダー。

import { usersApi } from "./users";
import { boardsApi } from "./boards";
import { tasksApi } from "./tasks";
import { categoriesApi } from "./categories";
import { positionsApi } from "./positions";
import type {
  BoardDto,
  TaskDto,
  CategoryDto,
  PositionDto,
  UserDto,
  BoardMemberDto,
  CreateTaskRequest,
  UpdateTaskRequest,
} from "./types";

import type { UserInfo } from "../types/userInfo";
import type { BoardInfo } from "../types/boardInfo";
import type { Category } from "../types/category";
import type { TaskInfo } from "../types/taskInfo";
import type { Position } from "../types/position";
import type { Member } from "../types/member";

/**
 * 指定ユーザーの board 一覧を取得し、UI 用のネスト構造へ組み立てる。
 * board ごとに positions / tasks を並列取得する。
 */
export const loadBoards = async (): Promise<BoardInfo[]> => {
  const boardDtos = await boardsApi.getMine();

  return Promise.all(
    boardDtos.map(async (board) => {
      const [positions, tasks, categories, members] = await Promise.all([
        positionsApi.getByBoard(board.id),
        tasksApi.getByBoard(board.id),
        categoriesApi.getByBoard(board.id),
        boardsApi.getMembers(board.id),
      ]);
      return toBoardInfo(board, positions, tasks, categories, members);
    }),
  );
};

/** 認証ユーザー自身の情報を取得する（初回は DB へ登録される）。 */
export const loadUser = async (): Promise<UserInfo> => {
  const dto = await usersApi.getMe();
  return toUserInfo(dto);
};

/** 指定ボードのゴミ箱（削除済みタスク）を UI 型で取得する（オーナーのみ）。 */
export const loadTrash = async (boardId: string): Promise<TaskInfo[]> => {
  const dtos = await tasksApi.getTrash(boardId);
  return dtos.map(toTaskInfo);
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

const toMember = (dto: BoardMemberDto): Member => {
  return { id: dto.userId, name: dto.name };
};

const toBoardInfo = (
  board: BoardDto,
  positions: PositionDto[],
  tasks: TaskDto[],
  categories: CategoryDto[],
  members: BoardMemberDto[],
): BoardInfo => {
  return {
    id: board.id,
    shortName: board.shortName,
    title: board.title,
    role: board.role,
    positions: positions.map(toPosition),
    categories: categories.map(toCategory),
    members: members.map(toMember),
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
    assigneeId: dto.assigneeId ?? "",
    orderIndex: dto.orderIndex,
  };
};

/** "YYYY-MM-DD" をローカルタイムの Date として解釈する（UTC 解釈による日ズレを防ぐ） */
const parseDateOnly = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

/** Date をローカルタイムの "YYYY-MM-DD" へ整形する（parseDateOnly の逆） */
const formatDateOnly = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * UI の TaskInfo を PUT 用ペイロードへ変換する。
 * 空文字の id は「未設定」として null に戻す（DTO → UI の逆変換）。
 */
export const toUpdateTaskRequest = (task: TaskInfo): UpdateTaskRequest => {
  return {
    positionId: task.positionId || null,
    categoryId: task.categoryId || null,
    assigneeId: task.assigneeId || null,
    name: task.name,
    comment: task.comment,
    importance: task.importance,
    deadline: task.deadline ? formatDateOnly(task.deadline) : null,
  };
};

/** UI の TaskInfo を POST 用ペイロードへ変換する。 */
export const toCreateTaskRequest = (
  task: TaskInfo,
  boardId: string,
): CreateTaskRequest => {
  return {
    id: task.id,
    boardId,
    positionId: task.positionId || null,
    categoryId: task.categoryId || null,
    assigneeId: task.assigneeId || null,
    name: task.name,
    comment: task.comment,
    importance: task.importance,
    deadline: task.deadline ? formatDateOnly(task.deadline) : null,
  };
};
