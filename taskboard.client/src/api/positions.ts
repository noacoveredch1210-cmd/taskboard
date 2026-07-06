import { api, toQuery } from "./client";
import type {
  PositionDto,
  CreatePositionRequest,
  UpdatePositionRequest,
} from "./types";

export const positionsApi = {
  getByBoard: (boardId: string) =>
    api.get<PositionDto[]>(`/positions${toQuery({ boardId })}`),

  getById: (id: string) => api.get<PositionDto>(`/positions/${id}`),

  create: (request: CreatePositionRequest) =>
    api.post<PositionDto>("/positions", request),

  update: (id: string, request: UpdatePositionRequest) =>
    api.put<void>(`/positions/${id}`, request),

  remove: (id: string) => api.delete<void>(`/positions/${id}`),
};
