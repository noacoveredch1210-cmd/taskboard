import { api, toQuery } from "./client";
import { createResource } from "./resource";
import type {
  BoardDto,
  CreateBoardRequest,
  UpdateBoardRequest,
} from "./types";

export const boardsApi = {
  ...createResource<BoardDto, CreateBoardRequest, UpdateBoardRequest>("/boards"),

  getByUser: (userId: string) =>
    api.get<BoardDto[]>(`/boards${toQuery({ userId })}`),
};
