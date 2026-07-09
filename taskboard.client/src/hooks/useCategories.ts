import { useEffect, useState } from "react";
import { loadCategories } from "../api/board-data";
import { categoriesApi } from "../api/categories";
import { reportError } from "./reportError";
import { useToast } from "../components/toast/ToastContext";
import type { Category } from "../types/category";

/**
 * カテゴリーの状態管理と API 連携をまとめたフック。
 * すべてオプティミスティック更新（即 state 反映 → API 送信 → 失敗したら巻き戻す）。
 */
export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const { showToast } = useToast();

  useEffect(() => {
    loadCategories()
      .then(setCategories)
      .catch(reportError("カテゴリーの取得に失敗しました"));
  }, []);

  /**
   * 失敗を通知し、サーバーを真としてカテゴリー一覧を取り直す（useBoards と同じ方針）。
   * 再取得すら失敗したら、操作前の snapshot へ戻す。
   */
  const handleFailure =
    (message: string, snapshot: Category[]) => (err: unknown) => {
      reportError(message)(err);
      showToast(message);
      loadCategories()
        .then(setCategories)
        .catch((refetchError) => {
          reportError("最新の状態を取得できませんでした")(refetchError);
          setCategories(snapshot);
        });
    };

  const setCategory = (categoryId: string, updates: Partial<Category>) => {
    const current = categories.find((c) => c.id === categoryId);
    if (!current) return;
    const merged = { ...current, ...updates };

    setCategories((prev) =>
      prev.map((category) => (category.id !== categoryId ? category : merged)),
    );
    categoriesApi
      .update(categoryId, { name: merged.name, color: merged.color })
      .catch(handleFailure("カテゴリーの更新に失敗しました", categories));
  };

  const createCategory = (name: string, color: string) => {
    const id = crypto.randomUUID();
    setCategories((prev) => [...prev, { id, name, color }]);
    categoriesApi
      .create({ id, name, color })
      .catch(handleFailure("カテゴリーの作成に失敗しました", categories));
  };

  const deleteCategories = (ids: string[]) => {
    setCategories((prev) =>
      prev.filter((category) => !ids.includes(category.id)),
    );
    ids.forEach((id) =>
      categoriesApi
        .remove(id)
        .catch(handleFailure("カテゴリーの削除に失敗しました", categories)),
    );
  };

  return { categories, setCategory, createCategory, deleteCategories };
};
