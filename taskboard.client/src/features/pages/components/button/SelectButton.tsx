type Props = {
  isSelectMode: boolean;
  onSetIsSelectMode: () => void;
};

const SelectButton = ({ isSelectMode, onSetIsSelectMode }: Props) => {
  return (
    <button
      type="button"
      onClick={onSetIsSelectMode}
      className="cursor-pointer text-primary hover:underline decoration-solid"
    >
      {isSelectMode ? "キャンセル" : "選択"}
    </button>
  );
};

export default SelectButton;
