import { useLayoutEffect, useRef, useState } from "react";

type Props = { onSend: (text: string) => void };

const ChatBox = ({ onSend }: Props) => {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 入力量に応じて高さを内容に合わせる(max-h-32 を超えたらスクロール)
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [input]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input);
    setInput("");
  };

  return (
    <div className="rounded border flex items-center justify-between gap-2 p-2">
      <textarea
        ref={textareaRef}
        className="focus:outline-none focus:ring-0 flex-1 min-w-0 px-2 resize-none max-h-32"
        placeholder="メッセージを入力..."
        rows={1}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          // Enterで送信、Shift+Enterは改行。IME変換中のEnterは無視
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            handleSend();
          }
        }}
      />
      <button
        type="button"
        className="btn-base bg-primary px-1 shrink-0 hover:bg-primary-hover"
        onClick={handleSend}
      >
        <span className="material-symbols-outlined">arrow_upward</span>
      </button>
    </div>
  );
};

export default ChatBox;
