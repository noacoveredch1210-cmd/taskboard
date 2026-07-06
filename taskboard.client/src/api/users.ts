import { api, toQuery } from "./client";
import { createResource } from "./resource";
import type {
  UserDto,
  CreateUserRequest,
  UpdateUserRequest,
} from "./types";

export const usersApi = {
  ...createResource<UserDto, CreateUserRequest, UpdateUserRequest>("/users"),

  getByEmail: (email: string) =>
    api.get<UserDto>(`/users/by-email${toQuery({ email })}`),
};
