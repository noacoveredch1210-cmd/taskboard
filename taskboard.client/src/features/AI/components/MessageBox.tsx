import type { Message } from "../index";

type Props = { messages: Message[] };

const MessageBox = ({ messages }: Props) => {
  return (
    <div className="pt-9 flex-1 overflow-y-auto flex flex-col gap-3">
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
    </div>
  );
};

export default MessageBox;
