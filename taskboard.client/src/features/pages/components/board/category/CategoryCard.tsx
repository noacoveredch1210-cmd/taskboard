import { useState } from "react";
import type { Category } from "../../../../../types/category";
import CustomCategoryModal from "./CustomCategoryModal";

type Props = {
  category: Category;
  isSelectMode: boolean;
  checked: boolean;
  onToggleSelect: (id: string) => void;
  onSetCategory: (categoryId: string, updates: Partial<Category>) => void;
};

const CategoryCard = ({
  category,
  isSelectMode,
  checked,
  onToggleSelect,
  onSetCategory,
}: Props) => {
  const [openCustomModal, setOpenCustomModal] = useState(false);
  return (
    <div className="flex items-center">
      <button
        onClick={() =>
          isSelectMode ? onToggleSelect(category.id) : setOpenCustomModal(true)
        }
        className={`cursor-pointer px-3 rounded flex gap-2 hover:text-primary`}
      >
        <span
          style={{
            color: category.color,
          }}
        >
          ●
        </span>
        {category.name}
      </button>
      {openCustomModal && (
        <CustomCategoryModal
          onClose={() => setOpenCustomModal(false)}
          category={category}
          onSetCategory={onSetCategory}
        />
      )}
      {isSelectMode && (
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggleSelect(category.id)}
          className="cursor-pointer w-5 h-5 accent-primary"
        ></input>
      )}
    </div>
  );
};

export default CategoryCard;
