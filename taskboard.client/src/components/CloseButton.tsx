type Props = {
  className: string;
  onClick: () => void;
};

const CloseButton = ({ className, onClick }: Props) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute top-1 right-1 px-1 pt-1 rounded ${className}`}
    >
      <span className="material-symbols-outlined">close</span>
    </button>
  );
};

export default CloseButton;
