import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AI from "./index";

// index.tsx 内の固定返信と同じ文言
const REPLY = "この機能は実装中です。今は使用できません。";

const button = (iconText: string) =>
  screen.getByText(iconText).closest("button") as HTMLButtonElement;

// 各テストごとに新しい user を用意し、入力状態がテスト間で漏れないようにする
let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
});

describe("AI", () => {
  it("開いているとき初期の案内メッセージと入力欄を表示する", () => {
    render(<AI isOpen={true} toggleAIWindow={vi.fn()} />);
    expect(screen.getByText(REPLY)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("メッセージを入力..."),
    ).toBeInTheDocument();
  });

  it("閉じているときは入力欄もメッセージも表示しない", () => {
    render(<AI isOpen={false} toggleAIWindow={vi.fn()} />);
    expect(
      screen.queryByPlaceholderText("メッセージを入力..."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(REPLY)).not.toBeInTheDocument();
  });

  it("トグルボタンで toggleAIWindow を呼ぶ", async () => {    const toggle = vi.fn();
    render(<AI isOpen={true} toggleAIWindow={toggle} />);
    await user.click(button("close"));
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it("メッセージ送信でユーザー発言と自動返信を追加し入力欄をクリアする", async () => {    render(<AI isOpen={true} toggleAIWindow={vi.fn()} />);
    const input = screen.getByPlaceholderText(
      "メッセージを入力...",
    ) as HTMLTextAreaElement;

    await user.type(input, "こんにちは");
    await user.click(button("arrow_upward"));

    expect(screen.getByText("こんにちは")).toBeInTheDocument();
    // 初期の案内 + 送信への返信 で 2 件
    expect(screen.getAllByText(REPLY)).toHaveLength(2);
    expect(input.value).toBe("");
  });

  it("空白のみのメッセージは送信しない", async () => {    render(<AI isOpen={true} toggleAIWindow={vi.fn()} />);
    await user.type(screen.getByPlaceholderText("メッセージを入力..."), "   ");
    await user.click(button("arrow_upward"));
    // 返信は初期の 1 件のまま
    expect(screen.getAllByText(REPLY)).toHaveLength(1);
  });
});
