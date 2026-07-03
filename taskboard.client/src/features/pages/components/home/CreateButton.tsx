type Props = {
  onOpenModal: () => void;
};

const CreateButton = ({ onOpenModal }: Props) => {
  return (
    <button
      type="button"
      onClick={onOpenModal}
      className="bg-primary-button hover:bg-primary-button-hover w-8 h-8 flex items-center justify-center rounded absolute bottom-2 right-2"
    >
      <span className="material-symbols-outlined">add</span>
    </button>
  );
};

export default CreateButton;
