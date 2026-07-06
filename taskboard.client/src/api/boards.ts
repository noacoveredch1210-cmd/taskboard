import { api, toQuery } from "./client";
import type {
  BoardDto,
  CreateBoardRequest,
  UpdateBoardRequest,
} from "./types";

export const boardsApi = {
  getByUser: (userId: string) =>
    api.get<BoardDto[]>(`/boards${toQuery({ userId })}`),

  getById: (id: string) => api.get<BoardDto>(`/boards/${id}`),

  create: (request: CreateBoardRequest) =>
    api.post<BoardDto>("/boards", request),

  update: (id: string, request: UpdateBoardRequest) =>
    api.put<void>(`/boards/${id}`, request),

  remove: (id: string) => api.delete<void>(`/boards/${id}`),
};
