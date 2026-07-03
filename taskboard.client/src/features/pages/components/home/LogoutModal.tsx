import ModalBase from "../ModalBase";

type Props = {
  onClose: () => void;
};

const LogoutModal = ({ onClose }: Props) => {
  return (
    <ModalBase className="p-10 flex flex-col gap-4" onClose={onClose}>
      <div>ログアウトしますか</div>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="btn-no">
          いいえ
        </button>
        <button
          onClick={() => {
            // ここにログアウト処理
            onClose();
          }}
          className="btn-yes"
        >
          はい
        </button>
      </div>
    </ModalBase>
  );
};

export default LogoutModal;
