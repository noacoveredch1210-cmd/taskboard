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

  /** 指定ボードのカテゴリー一覧（そのボードのメンバーのみ取得可）。 */
  getByBoard: (boardId: string) =>
    api.get<CategoryDto[]>(`/categories${toQuery({ boardId })}`),
};
