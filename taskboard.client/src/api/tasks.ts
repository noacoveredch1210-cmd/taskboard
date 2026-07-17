import { api, toQuery } from "./client";
import { createResource } from "./resource";
import type {
  TaskDto,
  CreateTaskRequest,
  UpdateTaskRequest,
  MoveTaskRequest,
} from "./types";

export const tasksApi = {
  ...createResource<TaskDto, CreateTaskRequest, UpdateTaskRequest>("/tasks"),

  getByBoard: (boardId: string) =>
    api.get<TaskDto[]>(`/tasks${toQuery({ boardId })}`),

  /**
   * 並べ替え。order_index は送らず「移動先の両隣」を送り、採番はサーバーに任せる。
   * 中間値の枯渇と振り直しは、サーバーが 1 トランザクションで面倒を見る。
   */
  move: (id: string, request: MoveTaskRequest) =>
    api.post<void>(`/tasks/${id}/move`, request),

  /** ゴミ箱（削除済み）のタスク一覧（オーナーのみ）。 */
  getTrash: (boardId: string) =>
    api.get<TaskDto[]>(`/tasks/trash${toQuery({ boardId })}`),

  /** ゴミ箱から元に戻す（オーナーのみ）。 */
  restore: (id: string) => api.post<void>(`/tasks/${id}/restore`),

  /** ゴミ箱から完全に削除する（オーナーのみ）。 */
  purge: (id: string) => api.delete<void>(`/tasks/${id}/purge`),

  /** ゴミ箱を空にする（オーナーのみ）。 */
  purgeAll: (boardId: string) =>
    api.delete<void>(`/tasks/trash${toQuery({ boardId })}`),
};
