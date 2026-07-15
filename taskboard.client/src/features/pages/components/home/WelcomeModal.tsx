import ModalBase from "../ModalBase";

type Props = {
  /** 「ボードを作る」を押したとき（ウェルカムを閉じて作成モーダルを開く） */
  onCreateBoard: () => void;
  /** 「あとで」で閉じる */
  onClose: () => void;
};

/** 初回起動時の案内。まずボードを作ってタスクを追加する流れを示す。 */
const WelcomeModal = ({ onCreateBoard, onClose }: Props) => {
  return (
    <ModalBase
      className="p-8 flex flex-col gap-5 w-md max-w-full"
      onClose={onClose}
    >
      <div className="text-xl font-bold">TaskBoard へようこそ 🎉</div>

      <div className="flex flex-col gap-3 text-sm text-gray-700">
        <p>
          ドラッグ＆ドロップで動かせる、シンプルなカンバン式のタスク管理です。
        </p>
        <ol className="flex flex-col gap-2 list-decimal pl-5">
          <li>まず「ボードの追加」からボードを作りましょう。</li>
          <li>列の先頭にある「＋」からタスクを追加できます。</li>
          <li>共有リンクを配れば、他の人と同じボードを使えます。</li>
        </ol>
        <p className="text-gray-500">
          操作に迷ったら、右側のチャット画面で AI に聞いてください。
        </p>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded border hover:bg-gray-100 px-4 py-1.5"
        >
          あとで
        </button>
        <button
          type="button"
          onClick={onCreateBoard}
          className="rounded bg-primary text-white hover:bg-primary-hover px-4 py-1.5"
        >
          ボードを作る
        </button>
      </div>
    </ModalBase>
  );
};

export default WelcomeModal;
