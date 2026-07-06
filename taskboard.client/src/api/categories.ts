import { api, toQuery } from "./client";
import { createResource } from "./resource";
import type {
  CategoryDto,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from "./types";

export const categoriesApi = {
  ...createResource<CategoryDto, CreateCategoryRequest, UpdateCategoryRequest>(
    "/categories",
  ),

  getByUser: (userId: string) =>
    api.get<CategoryDto[]>(`/categories${toQuery({ userId })}`),
};
