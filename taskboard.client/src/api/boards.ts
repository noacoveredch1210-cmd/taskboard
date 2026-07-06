import { api } from "./client";
import { createResource } from "./resource";
import type {
  BoardDto,
  CreateBoardRequest,
  UpdateBoardRequest,
} from "./types";

export const boardsApi = {
  ...createResource<BoardDto, CreateBoardRequest, UpdateBoardRequest>("/boards"),

  /** 認証ユーザー自身の board 一覧（対象ユーザーはサーバーがトークンから決定する）。 */
  getMine: () => api.get<BoardDto[]>("/boards"),
};
