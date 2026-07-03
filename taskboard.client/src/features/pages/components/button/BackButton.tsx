type Props = { onClose: () => void };

const BackButton = ({ onClose }: Props) => {
  return (
    <button className="btn-no" onClick={onClose}>
      戻る
    </button>
  );
};

export default BackButton;
