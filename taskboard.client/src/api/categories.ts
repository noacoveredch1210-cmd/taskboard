import { api, toQuery } from "./client";
import type {
  CategoryDto,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from "./types";

export const categoriesApi = {
  getByUser: (userId: string) =>
    api.get<CategoryDto[]>(`/categories${toQuery({ userId })}`),

  getById: (id: string) => api.get<CategoryDto>(`/categories/${id}`),

  create: (request: CreateCategoryRequest) =>
    api.post<CategoryDto>("/categories", request),

  update: (id: string, request: UpdateCategoryRequest) =>
    api.put<void>(`/categories/${id}`, request),

  remove: (id: string) => api.delete<void>(`/categories/${id}`),
};
