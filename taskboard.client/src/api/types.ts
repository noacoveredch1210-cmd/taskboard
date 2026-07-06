// サーバー（ASP.NET Core）が返す JSON は camelCase。
// 各 DTO は TaskBoard.Server.Models のレスポンスモデルに対応する。

export type UserDto = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export type BoardDto = {
  id: string;
  userId: string;
  shortName: string;
  title: string;
  createdAt: string;
};

export type TaskDto = {
  id: string;
  boardId: string;
  positionId: string | null;
  categoryId: string | null;
  name: string;
  comment: string | null;
  importance: number | null;
  /** ISO 日付文字列（例: "2026-07-06"） */
  deadline: string | null;
  /** 表示順（同一 position 内での並び順。分数を許容する） */
  orderIndex: number;
  createdAt: string;
};

export type CategoryDto = {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
};

export type PositionDto = {
  id: string;
  boardId: string;
  name: string;
  orderIndex: number;
  createdAt: string;
};

// ---- リクエストペイロード ----

export type CreateUserRequest = {
  id: string;
  name: string;
  email: string;
};
export type UpdateUserRequest = {
  name: string;
  email: string;
};

export type CreateBoardRequest = {
  id: string;
  userId: string;
  shortName: string;
  title: string;
};
export type UpdateBoardRequest = {
  shortName: string;
  title: string;
};

export type CreateTaskRequest = {
  id: string;
  boardId: string;
  positionId?: string | null;
  categoryId?: string | null;
  name: string;
  comment?: string | null;
  importance?: number | null;
  deadline?: string | null;
  orderIndex: number;
};
export type UpdateTaskRequest = {
  positionId?: string | null;
  categoryId?: string | null;
  name: string;
  comment?: string | null;
  importance?: number | null;
  deadline?: string | null;
  orderIndex: number;
};

export type CreateCategoryRequest = {
  id: string;
  userId: string;
  name: string;
  color: string;
};
export type UpdateCategoryRequest = {
  name: string;
  color: string;
};

export type CreatePositionRequest = {
  id: string;
  boardId: string;
  name: string;
  orderIndex: number;
};
export type UpdatePositionRequest = {
  name: string;
  orderIndex: number;
};
