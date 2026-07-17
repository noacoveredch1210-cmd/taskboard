import { useState } from "react";
import ModalBase from "../../ModalBase";
import type { Category } from "../../../../../types/category";
import CharCounter from "../../../../../components/CharCounter";
import { TEXT_LIMITS } from "../../../../../constants/textLimits";

type Props = {
  onClose: () => void;
  category?: Category;
  onCreateCategory?: (name: string, color: string) => void;
  onSetCategory?: (categoryId: string, updates: Partial<Category>) => void;
};

const CreateCategoryModal = ({
  onClose,
  category,
  onCreateCategory,
  onSetCategory,
}: Props) => {
  // ランダムな色をピックする
  const [colors] = useState(() =>
    Array.from(
      { length: 4 },
      () =>
        `#${Math.floor(Math.random() * 0xffffff)
          .toString(16)
          .padStart(6, "0")}`,
    ),
  );

  const [draftName, setDraftName] = useState(category?.name ?? "");
  const [draftColor, setDraftColor] = useState(category?.color ?? colors[0]);

  const isEmpty = draftName === "";

  return (
    <ModalBase className="p-5" onClose={onClose}>
      <div className="">
        <div className="font-medium py-1 text-lg">カテゴリーを追加</div>
        <input
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          maxLength={TEXT_LIMITS.categoryName}
          className="border rounded px-2 w-full min-w-100"
          placeholder="カテゴリー名を入力..."
        ></input>
        <CharCounter
          current={draftName.length}
          max={TEXT_LIMITS.categoryName}
        />
      </div>
      <div className="py-2">
        <div className="font-medium text-lg">テーマ色</div>
        <input
          type="color"
          list="color"
          value={draftColor}
          onChange={(e) => setDraftColor(e.target.value)}
          className="w-12 h-7 "
        ></input>
        <datalist id="color">
          <option value={colors[1]}></option>
          <option value={colors[2]}></option>
          <option value={colors[3]}></option>
        </datalist>
      </div>
      <div className="flex justify-end">
        <button
          onClick={() => {
            if (!isEmpty) {
              if (onSetCategory && category) {
                onSetCategory(category.id, {
                  name: draftName,
                  color: draftColor,
                });
              } else if (onCreateCategory) {
                onCreateCategory(draftName, draftColor);
              }
            }
            onClose();
          }}
          className="px-2 rounded font-medium bg-primary-button hover:bg-primary-button-hover"
        >
          {category ? "変更" : "追加"}
        </button>
      </div>
    </ModalBase>
  );
};

export default CreateCategoryModal;
