import { useState } from "react";
import ModalBase from "../ModalBase";

type Props = {
  onJoinBoard: (token: string) => Promise<"member" | "requested" | null>;
};

/** 貼られた共有リンク（または生のトークン）から token を取り出す。 */
const extractToken = (input: string): string => {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    return url.searchParams.get("join") ?? trimmed;
  } catch {
    // URL でなければトークンそのものとみなす
    return trimmed;
  }
};

const JoinBoardButton = ({ onJoinBoard }: Props) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    const token = extractToken(value);
    if (!token || isJoining) return;
    setIsJoining(true);
    const result = await onJoinBoard(token);
    setIsJoining(false);
    // 承認待ち・既参加のどちらでも（成功なら）モーダルを閉じる。失敗時は開いたまま。
    if (result) {
      setValue("");
      setOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-gray-200 btn-base px-5 border hover:bg-gray-300 min-w-0 truncate"
      >
        共有リンクで参加
      </button>
      {open && (
        <ModalBase
          className="p-8 flex flex-col gap-4 w-96 max-w-full"
          onClose={() => setOpen(false)}
        >
          <div className="font-bold">共有ボードに参加</div>
          <p className="text-sm text-gray-600">
            共有リンクを貼り付けてください。
          </p>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://.../?join=..."
            className="border rounded px-3 py-2"
          />
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-no"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleJoin}
              disabled={isJoining || !value.trim()}
              className="btn-yes disabled:opacity-50"
            >
              {isJoining ? "参加中…" : "参加する"}
            </button>
          </div>
        </ModalBase>
      )}
    </>
  );
};

export default JoinBoardButton;
