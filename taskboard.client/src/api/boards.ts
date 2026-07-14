import { api } from "./client";
import { createResource } from "./resource";
import type {
  BoardDto,
  BoardMemberDto,
  CreateBoardRequest,
  UpdateBoardRequest,
} from "./types";

export const boardsApi = {
  ...createResource<BoardDto, CreateBoardRequest, UpdateBoardRequest>("/boards"),

  /** 認証ユーザーが参加している board 一覧。 */
  getMine: () => api.get<BoardDto[]>("/boards"),

  /** 共有トークンを取得（オーナーのみ）。 */
  getShareToken: (boardId: string) =>
    api
      .get<{ shareToken: string }>(`/boards/${boardId}/share`)
      .then((res) => res.shareToken),

  /** 共有トークンで参加リクエストを出す（承認制）。 */
  join: (token: string) =>
    api.post<{ status: "member" | "requested"; board?: BoardDto }>(
      "/boards/join",
      { token },
    ),

  /** メンバー一覧。 */
  getMembers: (boardId: string) =>
    api.get<BoardMemberDto[]>(`/boards/${boardId}/members`),

  /** 保留中の参加リクエスト一覧（オーナーのみ）。 */
  getJoinRequests: (boardId: string) =>
    api.get<BoardMemberDto[]>(`/boards/${boardId}/requests`),

  /** 参加リクエストを承認する（オーナーのみ）。 */
  approveJoinRequest: (boardId: string, userId: string) =>
    api.post<void>(`/boards/${boardId}/requests/${userId}/approve`),

  /** 参加リクエストを却下する（オーナーのみ）。 */
  rejectJoinRequest: (boardId: string, userId: string) =>
    api.delete<void>(`/boards/${boardId}/requests/${userId}`),

  /** メンバーを外す（オーナーは他人を、本人は自分を退出させられる）。 */
  removeMember: (boardId: string, userId: string) =>
    api.delete<void>(`/boards/${boardId}/members/${userId}`),

  /** メンバーの役割を変える（オーナーのみ）。 */
  setMemberRole: (boardId: string, userId: string, role: "owner" | "member") =>
    api.put<void>(`/boards/${boardId}/members/${userId}`, { role }),
};
