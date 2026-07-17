import type { Category } from "../../../../../types/category";
import CategoryCard from "./CategoryCard";
import DeleteModal from "../../modal/DeleteModal";
import { useState, useRef, useEffect } from "react";
import SelectButton from "../../button/SelectButton";
import FooterMenu from "../../FooterMenu";
import ModalBase from "../../ModalBase";
import CreateButton from "../../CreateButton";
import CreateCategoryModal from "./CreateCategoryModal";
import type { BoardInfo } from "../../../../../types/boardInfo";

type Props = {
  categories: Category[];
  boardInfo: BoardInfo;
  onSetCategory: (categoryId: string, updates: Partial<Category>) => void;
  onCreateCategory: (boardId: string, name: string, color: string) => void;
  onDeleteCategories: (ids: string[]) => void;
  onClose: () => void;
};

const CategoryModal = ({
  categories,
  boardInfo,
  onSetCategory,
  onCreateCategory,
  onDeleteCategories,
  onClose,
}: Props) => {
  const [openConfirmModal, setOpenConfirmModal] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [openCreateCategoryModal, setOpenCreateCategoryModal] = useState(false);

  // チェックされたアイテムのid
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const rootRef = useRef<HTMLDivElement>(null);

  // View の外側をクリックしたら選択モードを解除する
  // (モーダル表示中はモーダル操作を優先するので無効)
  useEffect(() => {
    // openConfirmModal は boolean。`!== null` だと常に true になり、
    // このハンドラが一度も登録されない（＝外側クリックが効かない）。
    if (!isSelectMode || openConfirmModal) return;
    const handleOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsSelectMode(false);
        setSelectedIds([]);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isSelectMode, openConfirmModal]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // 選択モードを抜けるときは選択をクリア
  const toggleSelectMode = () => {
    setIsSelectMode((prev) => !prev);
    setSelectedIds([]);
  };

  const handleDelete = () => {
    onDeleteCategories(selectedIds);
    setSelectedIds([]);
    setIsSelectMode(false);
  };
  return (
    <>
      <ModalBase
        className="p-8 max-w-full flex flex-col gap-3"
        onClose={onClose}
      >
        <div className="text-lg font-medium">カテゴリー管理</div>
        <div>
          <CreateButton
            buttonName="カテゴリーを追加"
            onOpenModal={() => setOpenCreateCategoryModal(true)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div
            ref={rootRef}
            className="border-2 w-full min-h-100 max-h-100 overflow-x-auto relative flex flex-col min-w-150"
          >
            <div className="flex justify-between border-b-2 px-2 py-1 bg-primary-light">
              <span>カテゴリー一覧</span>
              <SelectButton
                isSelectMode={isSelectMode}
                onSetIsSelectMode={toggleSelectMode}
              />
            </div>
            <div className="p-3 flex flex-col gap-2 flex-1 overflow-y-auto min-h-0">
              {categories.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  onSetCategory={onSetCategory}
                  isSelectMode={isSelectMode}
                  checked={selectedIds.includes(category.id)}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </div>
            {isSelectMode && (
              <FooterMenu
                selectLength={selectedIds.length}
                onDelete={() => setOpenConfirmModal(true)}
              />
            )}
            {openConfirmModal && (
              <DeleteModal
                message="選択したカテゴリーを削除しますか？"
                onConfirm={handleDelete}
                onClose={() => setOpenConfirmModal(false)}
              />
            )}
          </div>
        </div>
      </ModalBase>
      {openCreateCategoryModal && (
        <CreateCategoryModal
          onClose={() => setOpenCreateCategoryModal(false)}
          onCreateCategory={(name, color) =>
            onCreateCategory(boardInfo.id, name, color)
          }
        />
      )}
    </>
  );
};

export default CategoryModal;
