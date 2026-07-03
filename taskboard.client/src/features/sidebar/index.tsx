import CloseButton from "../../components/CloseButton";
import HomeButton from "./components/HomeButton";
import BoardButton from "./components/BoardButton";
import type { BoardInfo } from "../../types/boardInfo";

type Props = {
  boards: BoardInfo[];
  openingPageIndex: number | null;
  isOpen: boolean;
  setOpeningPageIndex: (openingPageIndex: number | null) => void;
  toggleSidebar: () => void;
};

const Sidebar = ({
  boards,
  openingPageIndex,
  isOpen,
  setOpeningPageIndex,
  toggleSidebar,
}: Props) => {
  return (
    <div
      className={`bg-primary h-full relative pt-10 text-white ${isOpen ? "w-45" : "w-10"}`}
    >
      {isOpen ? (
        <CloseButton
          className="hover:bg-primary-hover"
          onClick={toggleSidebar}
        />
      ) : (
        <button
          type="button"
          className="px-1 pt-1 rounded absolute top-1 right-1 hover:bg-primary-hover"
          onClick={toggleSidebar}
        >
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      )}
      <HomeButton
        isOpen={openingPageIndex === null}
        isOpenSidebar={isOpen}
        openHome={() => setOpeningPageIndex(null)}
      />
      {boards.map((board, idx) => (
        <BoardButton
          shortName={board.shortName}
          isOpen={openingPageIndex === idx}
          isOpenSidebar={isOpen}
          openBoard={() => setOpeningPageIndex(idx)}
        />
      ))}
    </div>
  );
};

export default Sidebar;
