import ModalBase from "../ModalBase";
import { useAuth } from "../../../../auth/AuthContext";
import { reportError } from "../../../../hooks/reportError";

type Props = {
  onClose: () => void;
};

const LogoutModal = ({ onClose }: Props) => {
  const { signOut } = useAuth();

  const handleLogout = () => {
    // サインアウトすると AuthProvider のセッションが null になり、
    // App がログイン画面へ切り替わる。
    signOut().catch(reportError("ログアウトに失敗しました"));
    onClose();
  };

  return (
    <ModalBase className="p-10 flex flex-col gap-4" onClose={onClose}>
      <div>ログアウトしますか</div>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="btn-no">
          いいえ
        </button>
        <button onClick={handleLogout} className="btn-yes">
          はい
        </button>
      </div>
    </ModalBase>
  );
};

export default LogoutModal;
