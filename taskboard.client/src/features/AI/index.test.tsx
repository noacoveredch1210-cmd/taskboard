import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({ chat: vi.fn() }));
vi.mock("../../api/ai", () => ({ aiApi: { chat: mocks.chat } }));

import AI from "./index";
import { ApiError } from "../../api/client";

const GREETING =
  "TaskBoard の使い方をご案内します。ボードやタスクの操作など、お気軽にどうぞ。";

const button = (iconText: string) =>
  screen.getByText(iconText).closest("button") as HTMLButtonElement;

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  vi.clearAllMocks();
  user = userEvent.setup();
});

describe("AI", () => {
  it("開いているとき初期の案内メッセージと入力欄を表示する", () => {
    render(<AI isOpen={true} toggleAIWindow={vi.fn()} />);
    expect(screen.getByText(GREETING)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("メッセージを入力..."),
    ).toBeInTheDocument();
  });

  it("閉じているときは入力欄もメッセージも表示しない", () => {
    render(<AI isOpen={false} toggleAIWindow={vi.fn()} />);
    expect(
      screen.queryByPlaceholderText("メッセージを入力..."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(GREETING)).not.toBeInTheDocument();
  });

  it("トグルボタンで toggleAIWindow を呼ぶ", async () => {
    const toggle = vi.fn();
    render(<AI isOpen={true} toggleAIWindow={toggle} />);
    await user.click(button("close"));
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it("送信すると会話履歴をAPIへ渡し、応答を表示して入力欄をクリアする", async () => {
    mocks.chat.mockResolvedValue("ボードは左上の＋から作成できます。");
    render(<AI isOpen={true} toggleAIWindow={vi.fn()} />);
    const input = screen.getByPlaceholderText(
      "メッセージを入力...",
    ) as HTMLTextAreaElement;

    await user.type(input, "ボードの作り方は？");
    await user.click(button("arrow_upward"));

    expect(screen.getByText("ボードの作り方は？")).toBeInTheDocument();
    expect(
      await screen.findByText("ボードは左上の＋から作成できます。"),
    ).toBeInTheDocument();
    expect(input.value).toBe("");

    // 挨拶(assistant) + ユーザー発言 を履歴として送る
    expect(mocks.chat).toHaveBeenCalledWith([
      { role: "assistant", text: GREETING },
      { role: "user", text: "ボードの作り方は？" },
    ]);
  });

  it("応答待ちの間は考え中を表示し、二重送信させない", async () => {
    let resolve!: (v: string) => void;
    mocks.chat.mockReturnValue(new Promise<string>((r) => (resolve = r)));
    render(<AI isOpen={true} toggleAIWindow={vi.fn()} />);

    await user.type(
      screen.getByPlaceholderText("メッセージを入力..."),
      "使い方を教えて",
    );
    await user.click(button("arrow_upward"));

    // 送信中は「考え中」が出て、送信ボタンは無効
    expect(screen.getByLabelText("考え中")).toBeInTheDocument();
    expect(button("arrow_upward")).toBeDisabled();

    resolve("これが回答です");
    expect(await screen.findByText("これが回答です")).toBeInTheDocument();
    // 応答後は考え中が消える
    expect(screen.queryByLabelText("考え中")).not.toBeInTheDocument();
    // API 呼び出しは 1 回だけ
    expect(mocks.chat).toHaveBeenCalledTimes(1);
  });

  it("APIが失敗したら汎用のエラーメッセージを表示する", async () => {
    mocks.chat.mockRejectedValue(new Error("boom"));
    render(<AI isOpen={true} toggleAIWindow={vi.fn()} />);

    await user.type(
      screen.getByPlaceholderText("メッセージを入力..."),
      "質問です",
    );
    await user.click(button("arrow_upward"));

    expect(
      await screen.findByText(
        "うまく応答できませんでした。しばらくして再度お試しください。",
      ),
    ).toBeInTheDocument();
  });

  it("レート制限(429)のときは専用のメッセージを表示する", async () => {
    mocks.chat.mockRejectedValue(new ApiError(429, "too many"));
    render(<AI isOpen={true} toggleAIWindow={vi.fn()} />);

    await user.type(
      screen.getByPlaceholderText("メッセージを入力..."),
      "質問です",
    );
    await user.click(button("arrow_upward"));

    expect(
      await screen.findByText(
        "リクエストが集中しています。少し時間をおいて再度お試しください。",
      ),
    ).toBeInTheDocument();
  });

  it("リセットで会話を初期状態（案内のみ）に戻す", async () => {
    mocks.chat.mockResolvedValue("回答です");
    render(<AI isOpen={true} toggleAIWindow={vi.fn()} />);

    await user.type(
      screen.getByPlaceholderText("メッセージを入力..."),
      "質問です",
    );
    await user.click(button("arrow_upward"));
    expect(await screen.findByText("回答です")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "会話をリセット" }));

    // 案内だけが残り、これまでのやり取りは消える
    expect(screen.getAllByText(GREETING)).toHaveLength(1);
    expect(screen.queryByText("質問です")).not.toBeInTheDocument();
    expect(screen.queryByText("回答です")).not.toBeInTheDocument();
  });

  it("空白のみのメッセージは送信しない", async () => {
    render(<AI isOpen={true} toggleAIWindow={vi.fn()} />);
    await user.type(screen.getByPlaceholderText("メッセージを入力..."), "   ");
    await user.click(button("arrow_upward"));

    expect(mocks.chat).not.toHaveBeenCalled();
    // 案内は初期の 1 件のまま
    expect(screen.getAllByText(GREETING)).toHaveLength(1);
  });
});
