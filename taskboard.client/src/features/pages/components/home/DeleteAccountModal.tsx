import { useState } from "react";
import ModalBase from "../ModalBase";
import { useAuth } from "../../../../auth/AuthContext";
import { useToast } from "../../../../components/toast/ToastContext";
import { usersApi } from "../../../../api";

type Props = {
  onClose: () => void;
};

const DeleteAccountModal = ({ onClose }: Props) => {
  const { signOut } = useAuth();
  const { showToast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      // データを削除してからサインアウトする。順序が逆だと、削除前に
      // セッションが切れて API 呼び出しが 401 になる。
      await usersApi.deleteMe();
      await signOut();
      // signOut で AuthProvider のセッションが null になり、App がログイン画面へ切り替わる。
    } catch {
      showToast("退会処理に失敗しました。時間をおいて再度お試しください。");
      setIsDeleting(false);
    }
  };

  return (
    <ModalBase className="p-10 flex flex-col gap-4" onClose={onClose}>
      <div className="font-bold text-red-600">本当に退会しますか？</div>
      <p className="text-sm text-gray-600">
        すべてのボード・タスク・カテゴリーが削除され、元に戻せません。
      </p>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} disabled={isDeleting} className="btn-no">
          キャンセル
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="btn-base bg-red-600 text-white px-4 hover:bg-red-700 disabled:opacity-50"
        >
          {isDeleting ? "処理中…" : "退会する"}
        </button>
      </div>
    </ModalBase>
  );
};

export default DeleteAccountModal;
