import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatBox from "./ChatBox";

const textarea = () =>
  screen.getByPlaceholderText("メッセージを入力...") as HTMLTextAreaElement;

// 各テストごとに新しい user を用意し、入力状態がテスト間で漏れないようにする
let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
});

describe("ChatBox", () => {
  it("Enter で送信し入力をクリアする", async () => {    const onSend = vi.fn();
    render(<ChatBox onSend={onSend} />);
    await user.type(textarea(), "やあ{Enter}");
    expect(onSend).toHaveBeenCalledWith("やあ");
    expect(textarea().value).toBe("");
  });

  it("Shift+Enter では送信しない（改行）", async () => {    const onSend = vi.fn();
    render(<ChatBox onSend={onSend} />);
    await user.type(textarea(), "改行したい{Shift>}{Enter}{/Shift}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("送信ボタンでも送信する", async () => {    const onSend = vi.fn();
    render(<ChatBox onSend={onSend} />);
    await user.type(textarea(), "送信");
    await user.click(screen.getByText("arrow_upward").closest("button")!);
    expect(onSend).toHaveBeenCalledWith("送信");
  });

  it("空・空白のみでは送信しない", async () => {    const onSend = vi.fn();
    render(<ChatBox onSend={onSend} />);
    await user.type(textarea(), "   ");
    await user.click(screen.getByText("arrow_upward").closest("button")!);
    expect(onSend).not.toHaveBeenCalled();
  });
});
