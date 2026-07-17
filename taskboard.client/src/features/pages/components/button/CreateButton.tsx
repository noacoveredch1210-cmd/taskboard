type Props = {
  buttonName: string;
  onOpenModal: () => void;
};

const CreateButton = ({ buttonName, onOpenModal }: Props) => {
  return (
    <button
      type="button"
      onClick={onOpenModal}
      className="btn-base px-5 border min-w-0 truncate bg-primary-button hover:bg-primary-button-hover"
    >
      {buttonName}
    </button>
  );
};

export default CreateButton;
