type Props = {
  shortName: string;
  isOpen: boolean;
  isOpenSidebar: boolean;
  openBoard: () => void;
};

const BoardButton = ({
  shortName,
  isOpen,
  isOpenSidebar,
  openBoard,
}: Props) => {
  return (
    <button
      className={`flex px-3 w-full py-2 hover:bg-[#f5f5f5] hover:text-primary ${isOpen ? "bg-bg-base text-primary" : "text-white"} ${isOpenSidebar ? "" : "justify-center"}`}
      onClick={openBoard}
    >
      <span className="material-symbols-outlined px-1">list_alt_check</span>
      {isOpenSidebar && <div className="px-1">{shortName}</div>}
    </button>
  );
};

export default BoardButton;
