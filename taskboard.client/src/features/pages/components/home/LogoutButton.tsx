import { useState } from "react";
import LogoutModal from "./LogoutModal";

const LogoutButton = () => {
  const [openModal, setOpenModal] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenModal(true)}
        className="bg-gray-200 btn-base px-5 border hover:bg-gray-300 min-w-0 truncate"
      >
        ログアウト
      </button>
      {openModal && <LogoutModal onClose={() => setOpenModal(false)} />}
    </>
  );
};

export default LogoutButton;
