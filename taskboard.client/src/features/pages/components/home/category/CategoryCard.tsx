import { useState } from "react";
import type { Category } from "../../../../../types/category";
import CategoryModal from "../../modal/CategoryModal";

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
        className={`px-3 rounded flex gap-2 hover:text-primary`}
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
        <CategoryModal
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
          className="w-5 h-5 accent-primary"
        ></input>
      )}
    </div>
  );
};

export default CategoryCard;
