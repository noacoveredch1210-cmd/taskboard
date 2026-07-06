import { useEffect, useState } from "react";
import { loadCategories } from "../api/board-data";
import { categoriesApi } from "../api/categories";
import { reportError } from "./reportError";
import type { Category } from "../types/category";

/**
 * カテゴリーの状態管理と API 連携をまとめたフック。
 * すべてオプティミスティック更新（即 state 反映 → API 送信 → 失敗はログ）。
 */
export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    loadCategories()
      .then(setCategories)
      .catch(reportError("カテゴリーの取得に失敗しました"));
  }, []);

  const setCategory = (categoryId: string, updates: Partial<Category>) => {
    const current = categories.find((c) => c.id === categoryId);
    if (!current) return;
    const merged = { ...current, ...updates };

    setCategories((prev) =>
      prev.map((category) => (category.id !== categoryId ? category : merged)),
    );
    categoriesApi
      .update(categoryId, { name: merged.name, color: merged.color })
      .catch(reportError("カテゴリーの更新に失敗しました"));
  };

  const createCategory = (name: string, color: string) => {
    const id = crypto.randomUUID();
    setCategories((prev) => [...prev, { id, name, color }]);
    categoriesApi
      .create({ id, name, color })
      .catch(reportError("カテゴリーの作成に失敗しました"));
  };

  const deleteCategories = (ids: string[]) => {
    setCategories((prev) =>
      prev.filter((category) => !ids.includes(category.id)),
    );
    ids.forEach((id) =>
      categoriesApi
        .remove(id)
        .catch(reportError("カテゴリーの削除に失敗しました")),
    );
  };

  return { categories, setCategory, createCategory, deleteCategories };
};
