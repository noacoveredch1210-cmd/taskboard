import { useState } from "react";
import CloseButton from "../../components/CloseButton";
import ChatBox from "./components/ChatBox";
import MessageBox from "./components/MessageBox";

type Props = { isOpen: boolean; toggleAIWindow: () => void };

export type Message = { id: string; role: "user" | "assistant"; text: string };

// AI機能は未実装のため、送信されたら固定の返信を返す
const NOT_IMPLEMENTED_REPLY = "この機能は実装中です。今は使用できません。";

const AI = ({ isOpen, toggleAIWindow }: Props) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      text: NOT_IMPLEMENTED_REPLY,
    },
  ]);

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text: trimmed },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: NOT_IMPLEMENTED_REPLY,
      },
    ]);
  };

  return (
    <div
      className={`${isOpen ? "w-70" : "w-10"} bg-white shadow h-full p-3 flex flex-col`}
    >
      {isOpen ? (
        <CloseButton className="hover:bg-gray-200" onClick={toggleAIWindow} />
      ) : (
        <button
          className="px-1 pt-1 rounded absolute top-1 right-1 hover:bg-gray-200"
          onClick={toggleAIWindow}
        >
          <span className="material-symbols-outlined">grid_layout_side</span>
        </button>
      )}
      {isOpen && (
        <div className="flex min-h-0 flex-col gap-3">
          <MessageBox messages={messages} />
          <ChatBox onSend={handleSend} />
        </div>
      )}
    </div>
  );
};

export default AI;
