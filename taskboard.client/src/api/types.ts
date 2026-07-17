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
  /** リクエストしたユーザーのこのボードでの役割 */
  role: "owner" | "member";
  createdAt: string;
};

export type BoardMemberDto = {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "member";
};

export type TaskDto = {
  id: string;
  boardId: string;
  positionId: string | null;
  categoryId: string | null;
  assigneeId: string | null;
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
  boardId: string;
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
  shortName: string;
  title: string;
};
export type UpdateBoardRequest = {
  shortName: string;
  title: string;
  /**
   * 列の「あるべき姿」を丸ごと送る（配列順がそのまま表示順）。
   * 送らなかった既存の列はサーバーが削除し、そこにあったタスクは先頭の列へ退避される。
   * 省略すると列には触れない。
   */
  positions?: { id: string; name: string }[];
};

/** 作成。orderIndex は送らない（新規タスクはサーバーがそのカラムの先頭へ入れる）。 */
export type CreateTaskRequest = {
  id: string;
  boardId: string;
  positionId?: string | null;
  categoryId?: string | null;
  assigneeId?: string | null;
  name: string;
  comment?: string | null;
  importance?: number | null;
  deadline?: string | null;
};
/**
 * 編集。orderIndex は送らない（並べ替えは move の担当）。
 * クライアントが持つ orderIndex はサーバーの採番・振り直しの後では古いので、
 * 編集のたびに書き戻すと、直ったばかりの並びを壊してしまう。
 */
export type UpdateTaskRequest = {
  positionId?: string | null;
  categoryId?: string | null;
  assigneeId?: string | null;
  name: string;
  comment?: string | null;
  importance?: number | null;
  deadline?: string | null;
};

/**
 * 並べ替え。order_index は載せない（採番はサーバーの担当）。
 * 移動先での両隣を送る。先頭なら prevTaskId、末尾なら nextTaskId が null。
 */
export type MoveTaskRequest = {
  positionId?: string | null;
  prevTaskId?: string | null;
  nextTaskId?: string | null;
};

export type CreateCategoryRequest = {
  id: string;
  boardId: string;
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
