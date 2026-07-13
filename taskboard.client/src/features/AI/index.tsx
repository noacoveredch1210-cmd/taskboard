import { useState } from "react";
import CloseButton from "../../components/CloseButton";
import ChatBox from "./components/ChatBox";
import MessageBox from "./components/MessageBox";
import { aiApi } from "../../api/ai";
import { ApiError } from "../../api/client";

type Props = { isOpen: boolean; toggleAIWindow: () => void };

export type Message = { id: string; role: "user" | "assistant"; text: string };

const GREETING =
  "TaskBoard の使い方をご案内します。ボードやタスクの操作など、お気軽にどうぞ。";

/** 失敗の種類に応じてユーザー向けの文言を選ぶ。 */
const errorText = (err: unknown): string => {
  if (err instanceof ApiError && err.status === 429) {
    return "リクエストが集中しています。少し時間をおいて再度お試しください。";
  }
  return "うまく応答できませんでした。しばらくして再度お試しください。";
};

const AI = ({ isOpen, toggleAIWindow }: Props) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: crypto.randomUUID(), role: "assistant", text: GREETING },
  ]);
  // 送信中は二重送信を防ぎ、考え中の表示を出す
  const [isSending, setIsSending] = useState(false);

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text: trimmed,
    };
    const history = [...messages, userMessage];
    setMessages(history);
    setIsSending(true);

    try {
      const reply = await aiApi.chat(
        history.map(({ role, text }) => ({ role, text })),
      );
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: reply },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: errorText(err) },
      ]);
    } finally {
      setIsSending(false);
    }
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
          <span className="material-symbols-outlined">support_agent</span>
        </button>
      )}
      {isOpen && (
        <div className="flex min-h-0 flex-col gap-3">
          <MessageBox messages={messages} pending={isSending} />
          <ChatBox onSend={handleSend} disabled={isSending} />
        </div>
      )}
    </div>
  );
};

export default AI;
