type Props = {
  onClick: () => void;
};

const CreateTaskButton = ({ onClick }: Props) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer flex items-center hover:bg-gray-200 rounded"
    >
      <span className="material-symbols-outlined">add</span>
    </button>
  );
};

export default CreateTaskButton;
