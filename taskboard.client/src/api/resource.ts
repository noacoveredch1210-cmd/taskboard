import { api } from "./client";

/** id ベースの標準 CRUD メソッド群 */
export type CrudResource<T, TCreate, TUpdate> = {
  getById: (id: string) => Promise<T>;
  create: (request: TCreate) => Promise<T>;
  update: (id: string, request: TUpdate) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

/**
 * `/tasks` のようなベースパスから、標準的な CRUD メソッドを生成する。
 * リソース固有の取得（getByUser など）は各モジュールで追加する。
 */
export const createResource = <T, TCreate, TUpdate>(
  basePath: string,
): CrudResource<T, TCreate, TUpdate> => ({
  getById: (id) => api.get<T>(`${basePath}/${id}`),
  create: (request) => api.post<T>(basePath, request),
  update: (id, request) => api.put<void>(`${basePath}/${id}`, request),
  remove: (id) => api.delete<void>(`${basePath}/${id}`),
});
