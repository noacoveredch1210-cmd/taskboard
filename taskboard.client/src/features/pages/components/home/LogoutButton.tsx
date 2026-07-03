import { useState } from "react";
import LogoutModal from "./LogoutModal";

const LogoutButton = () => {
  const [openModal, setOpenModal] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenModal(true)}
        className="bg-gray-200 rounded px-5 border hover:bg-gray-300"
      >
        ログアウト
      </button>
      {openModal && <LogoutModal onClose={() => setOpenModal(false)} />}
    </>
  );
};

export default LogoutButton;
