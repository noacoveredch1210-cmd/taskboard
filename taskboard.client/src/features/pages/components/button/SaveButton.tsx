type Props = {
  onSave: () => void;
  onClose: () => void;
};

const SaveButton = ({ onSave, onClose }: Props) => {
  return (
    <button
      className="btn-yes"
      onClick={() => {
        onSave();
        onClose();
      }}
    >
      保存
    </button>
  );
};

export default SaveButton;
