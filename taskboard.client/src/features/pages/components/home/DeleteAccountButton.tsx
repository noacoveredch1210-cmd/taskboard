import { useState } from "react";
import DeleteAccountModal from "./DeleteAccountModal";

/** 退会の入口。誤操作を避けるため控えめな見た目にし、確認モーダルを挟む。 */
const DeleteAccountButton = () => {
  const [openModal, setOpenModal] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenModal(true)}
        className="text-sm text-gray-400 underline hover:text-red-600"
      >
        アプリを退会する
      </button>
      {openModal && <DeleteAccountModal onClose={() => setOpenModal(false)} />}
    </>
  );
};

export default DeleteAccountButton;
