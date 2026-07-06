import { api, toQuery } from "./client";
import type {
  UserDto,
  CreateUserRequest,
  UpdateUserRequest,
} from "./types";

export const usersApi = {
  getById: (id: string) => api.get<UserDto>(`/users/${id}`),

  getByEmail: (email: string) =>
    api.get<UserDto>(`/users/by-email${toQuery({ email })}`),

  create: (request: CreateUserRequest) =>
    api.post<UserDto>("/users", request),

  update: (id: string, request: UpdateUserRequest) =>
    api.put<void>(`/users/${id}`, request),

  remove: (id: string) => api.delete<void>(`/users/${id}`),
};
