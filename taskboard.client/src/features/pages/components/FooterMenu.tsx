type Props = {
  selectLength: number;
  onDelete: () => void;
};

const FooterMenu = ({ selectLength, onDelete }: Props) => {
  return (
    <div className="bg-primary-light border-t px-3 shadow w-full h-10 flex items-center justify-end gap-2">
      {selectLength !== 0 && (
        <div className="cursor-default">{selectLength}個のアイテムを選択中</div>
      )}
      <button
        onClick={onDelete}
        disabled={selectLength === 0}
        className="cursor-pointer pt-1 px-1 text-red-600 hover:text-red-700 disabled:text-gray-400"
      >
        <span className="material-symbols-outlined">delete</span>
      </button>
    </div>
  );
};

export default FooterMenu;
