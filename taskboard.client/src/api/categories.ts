import { api } from "./client";
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

  /** 認証ユーザー自身のカテゴリー一覧（対象ユーザーはサーバーがトークンから決定する）。 */
  getMine: () => api.get<CategoryDto[]>("/categories"),
};
