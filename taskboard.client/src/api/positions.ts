import { api, toQuery } from "./client";
import { createResource } from "./resource";
import type {
  PositionDto,
  CreatePositionRequest,
  UpdatePositionRequest,
} from "./types";

export const positionsApi = {
  ...createResource<PositionDto, CreatePositionRequest, UpdatePositionRequest>(
    "/positions",
  ),

  getByBoard: (boardId: string) =>
    api.get<PositionDto[]>(`/positions${toQuery({ boardId })}`),
};
