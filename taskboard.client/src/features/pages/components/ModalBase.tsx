import { useRef } from "react";
import { useDialogController } from "../../../hooks/useDialogController";
import CloseButton from "../../../components/CloseButton";

type Props = {
  className: string;
  onClose: () => void;
  children: React.ReactNode;
};

const ModalBase = ({ className = "", onClose, children }: Props) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const safeClose = () => {
    dialogRef.current?.close();
    onClose();
  };

  useDialogController(dialogRef, true, safeClose);

  return (
    <dialog ref={dialogRef} className={`dialog-modal relative ${className}`}>
      <CloseButton className="hover:bg-gray-200" onClick={safeClose} />
      {children}
    </dialog>
  );
};

export default ModalBase;
