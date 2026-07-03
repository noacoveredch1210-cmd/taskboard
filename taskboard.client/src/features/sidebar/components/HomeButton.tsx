type Props = {
  isOpen: boolean;
  isOpenSidebar: boolean;
  openHome: () => void;
};

const HomeButton = ({ isOpen, isOpenSidebar, openHome }: Props) => {
  return (
    <button
      className={`flex px-3 w-full py-2 hover:bg-bg-base hover:text-primary ${isOpen ? "bg-[#f5f5f5] text-primary" : "text-white "} ${isOpenSidebar ? "" : "justify-center"}`}
      onClick={openHome}
    >
      <span className="material-symbols-outlined px-1">home</span>
      {isOpenSidebar && <div className="px-1">Home</div>}
    </button>
  );
};

export default HomeButton;
