import { api, toQuery } from "./client";
import type {
  TaskDto,
  CreateTaskRequest,
  UpdateTaskRequest,
} from "./types";

export const tasksApi = {
  getByBoard: (boardId: string) =>
    api.get<TaskDto[]>(`/tasks${toQuery({ boardId })}`),

  getById: (id: string) => api.get<TaskDto>(`/tasks/${id}`),

  create: (request: CreateTaskRequest) =>
    api.post<TaskDto>("/tasks", request),

  update: (id: string, request: UpdateTaskRequest) =>
    api.put<void>(`/tasks/${id}`, request),

  remove: (id: string) => api.delete<void>(`/tasks/${id}`),
};
