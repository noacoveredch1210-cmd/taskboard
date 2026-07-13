import { useEffect, useRef } from "react";
import type { Message } from "../index";

type Props = { messages: Message[]; pending?: boolean };

const MessageBox = ({ messages, pending = false }: Props) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 新しいメッセージが増えた/考え中になったら最新(最下部)まで送る
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  return (
    <div
      ref={scrollRef}
      // mr-8: スクロールバーを右上の×ボタンの左へ逃がして重なりを防ぐ
      className="pt-1 mt-8 flex-1 min-h-0 overflow-y-auto flex flex-col gap-3"
    >
      {messages.map((message) => (
        <div
          key={message.id}
          className={message.role === "user" ? "self-end" : "self-start"}
        >
          <div
            className={`rounded px-3 py-2 max-w-55 wrap-break-word whitespace-pre-wrap ${
              message.role === "user" ? "bg-primary-light" : "bg-gray-100"
            }`}
          >
            {message.text}
          </div>
        </div>
      ))}
      {pending && (
        <div className="self-start" aria-label="考え中">
          <div className="rounded bg-gray-100 px-3 py-2">
            <span className="animate-pulse">考え中…</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageBox;
