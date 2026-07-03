import ModalBase from "../ModalBase";

type Props = {
  message?: string;
  onConfirm: () => void;
  onClose: () => void;
};

const DeleteModal = ({
  message = "選択したアイテムを削除しますか？",
  onConfirm,
  onClose,
}: Props) => {
  return (
    <ModalBase className="p-10 flex flex-col gap-4" onClose={onClose}>
      <div>
        <div>{message}</div>
        <div className="text-gray-500">※この処理は元には戻せません。</div>
      </div>
      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="rounded border hover:bg-gray-100 w-20"
        >
          いいえ
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className="w-20 rounded bg-red-600 text-white hover:bg-red-700"
        >
          はい
        </button>
      </div>
    </ModalBase>
  );
};

export default DeleteModal;
