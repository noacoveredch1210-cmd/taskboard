import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import SelectButton from "../button/SelectButton";
import FooterMenu from "../FooterMenu";
import CreateButton from "./CreateButton";

type Identifiable = { id: string };

type Props<T extends Identifiable> = {
  title: string;
  items: T[];
  onDelete: (ids: string[]) => void;
  // アイテム1件の描画。選択モードの状態を受け取る
  renderItem: (
    item: T,
    ctx: {
      isSelectMode: boolean;
      checked: boolean;
      onToggleSelect: (id: string) => void;
    },
  ) => ReactNode;
  // 作成モーダル。開閉はView側が管理し、閉じる関数を渡す
  renderCreateModal: (close: () => void) => ReactNode;
  // 削除確認モーダル。確定(削除実行)関数と閉じる関数を渡す
  renderConfirmModal: (onConfirm: () => void, close: () => void) => ReactNode;
  // 0件のとき + ボタンの横に常時表示する案内ラベル（未指定なら表示しない）
  emptyHint?: string;
};

// board / category など「一覧＋選択削除＋作成」を共通化した汎用ビュー
const View = <T extends Identifiable>({
  title,
  items,
  onDelete,
  renderItem,
  renderCreateModal,
  renderConfirmModal,
  emptyHint,
}: Props<T>) => {
  const [openModal, setOpenModal] = useState<null | "confirm" | "create">(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  // チェックされたアイテムのid
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const rootRef = useRef<HTMLDivElement>(null);

  // View の外側をクリックしたら選択モードを解除する
  // (モーダル表示中はモーダル操作を優先するので無効)
  useEffect(() => {
    if (!isSelectMode || openModal !== null) return;
    const handleOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsSelectMode(false);
        setSelectedIds([]);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isSelectMode, openModal]);

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
    onDelete(selectedIds);
    setSelectedIds([]);
    setIsSelectMode(false);
  };

  return (
    <div
      ref={rootRef}
      className="border-2 w-full h-70 relative flex flex-col min-w-150"
    >
      <div className="flex justify-between border-b-2 px-2 py-1 bg-primary-light">
        <span>{title}</span>
        <SelectButton
          isSelectMode={isSelectMode}
          onSetIsSelectMode={toggleSelectMode}
        />
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1 overflow-y-auto min-h-0">
        {items.map((item) => (
          <Fragment key={item.id}>
            {renderItem(item, {
              isSelectMode,
              checked: selectedIds.includes(item.id),
              onToggleSelect: toggleSelect,
            })}
          </Fragment>
        ))}
      </div>
      {isSelectMode ? (
        <FooterMenu
          selectLength={selectedIds.length}
          onDelete={() => setOpenModal("confirm")}
        />
      ) : (
        <>
          {items.length === 0 && emptyHint && (
            <button
              type="button"
              onClick={() => setOpenModal("create")}
              className="absolute bottom-2 right-12 h-8 flex items-center gap-1 whitespace-nowrap text-sm font-medium text-primary animate-bounce cursor-pointer"
            >
              <span>{emptyHint}</span>
              <span className="material-symbols-outlined text-lg!">
                arrow_forward
              </span>
            </button>
          )}
          <CreateButton onOpenModal={() => setOpenModal("create")} />
        </>
      )}
      {openModal === "create" && renderCreateModal(() => setOpenModal(null))}
      {openModal === "confirm" &&
        renderConfirmModal(handleDelete, () => setOpenModal(null))}
    </div>
  );
};

export default View;
