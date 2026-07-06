import { api, toQuery } from "./client";
import { createResource } from "./resource";
import type {
  TaskDto,
  CreateTaskRequest,
  UpdateTaskRequest,
} from "./types";

export const tasksApi = {
  ...createResource<TaskDto, CreateTaskRequest, UpdateTaskRequest>("/tasks"),

  getByBoard: (boardId: string) =>
    api.get<TaskDto[]>(`/tasks${toQuery({ boardId })}`),
};
