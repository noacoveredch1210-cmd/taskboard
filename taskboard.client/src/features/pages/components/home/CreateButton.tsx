type Props = {
  onOpenModal: () => void;
};

const CreateButton = ({ onOpenModal }: Props) => {
  return (
    <button
      type="button"
      onClick={onOpenModal}
      className="btn-base  px-5 border min-w-0 truncate bg-primary-button hover:bg-primary-button-hover"
    >
      ボードの追加
    </button>
  );
};

export default CreateButton;
