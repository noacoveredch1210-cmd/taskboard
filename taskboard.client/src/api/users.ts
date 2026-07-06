import { api } from "./client";
import type { UserDto, UpdateUserRequest } from "./types";

export const usersApi = {
  /** 認証ユーザー自身の情報を取得（初回は DB へ登録される）。 */
  getMe: () => api.get<UserDto>("/users/me"),

  updateMe: (request: UpdateUserRequest) =>
    api.put<void>("/users/me", request),
};
