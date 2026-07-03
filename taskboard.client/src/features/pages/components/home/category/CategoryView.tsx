import type { Category } from "../../../../../types/category";
import CategoryCard from "./CategoryCard";
import CategoryModal from "../../modal/CategoryModal";
import DeleteModal from "../../modal/DeleteModal";
import View from "../View";

type Props = {
  categories: Category[];
  onCreateCategory: (name: string, color: string) => void;
  onSetCategory: (categoryId: string, updates: Partial<Category>) => void;
  onDeleteCategories: (ids: string[]) => void;
};

const CategoryView = ({
  categories,
  onCreateCategory,
  onSetCategory,
  onDeleteCategories,
}: Props) => (
  <View
    title="カテゴリー 管理"
    items={categories}
    onDelete={onDeleteCategories}
    renderItem={(category, ctx) => (
      <CategoryCard
        category={category}
        onSetCategory={onSetCategory}
        {...ctx}
      />
    )}
    renderCreateModal={(close) => (
      <CategoryModal onClose={close} onCreateCategory={onCreateCategory} />
    )}
    renderConfirmModal={(onConfirm, close) => (
      <DeleteModal
        message="選択したカテゴリーを削除しますか？"
        onConfirm={onConfirm}
        onClose={close}
      />
    )}
  />
);

export default CategoryView;
