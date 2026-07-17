import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JoinBoardButton from "./JoinBoardButton";

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  vi.clearAllMocks();
  user = userEvent.setup();
});

const renderButton = (
  onJoinBoard = vi.fn().mockResolvedValue("requested" as const),
) => {
  render(<JoinBoardButton onJoinBoard={onJoinBoard} />);
  return { onJoinBoard };
};

/** モーダルを開いて入力し、参加する。 */
const join = async (input: string) => {
  await user.click(screen.getByRole("button", { name: "共有リンクで参加" }));
  await user.type(screen.getByRole("textbox"), input);
  await user.click(screen.getByRole("button", { name: "参加する" }));
};

describe("JoinBoardButton（貼られた文字列からトークンを取り出す）", () => {
  it("共有リンクを貼ると ?join= の値を渡す", async () => {
    const { onJoinBoard } = renderButton();
    await join("https://example.com/?join=abc123");
    await waitFor(() => expect(onJoinBoard).toHaveBeenCalledWith("abc123"));
  });

  it("生のトークンを貼るとそのまま渡す", async () => {
    const { onJoinBoard } = renderButton();
    await join("abc123");
    await waitFor(() => expect(onJoinBoard).toHaveBeenCalledWith("abc123"));
  });

  it("前後の空白は落とす", async () => {
    const { onJoinBoard } = renderButton();
    await join("  abc123  ");
    await waitFor(() => expect(onJoinBoard).toHaveBeenCalledWith("abc123"));
  });

  it("URL でも join が無ければ入力そのものを渡す", async () => {
    const { onJoinBoard } = renderButton();
    await join("https://example.com/board");
    await waitFor(() =>
      expect(onJoinBoard).toHaveBeenCalledWith("https://example.com/board"),
    );
  });
});

describe("JoinBoardButton（参加の結果）", () => {
  it("承認待ちになったらモーダルを閉じる", async () => {
    renderButton(vi.fn().mockResolvedValue("requested"));
    await join("abc123");
    await waitFor(() =>
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument(),
    );
  });

  it("既にメンバーだった場合も閉じる", async () => {
    renderButton(vi.fn().mockResolvedValue("member"));
    await join("abc123");
    await waitFor(() =>
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument(),
    );
  });

  it("失敗（null）なら開いたままにする", async () => {
    renderButton(vi.fn().mockResolvedValue(null));
    await join("bad-token");
    await waitFor(() => expect(screen.getByRole("textbox")).toBeInTheDocument());
  });

  it("未入力では参加できない", async () => {
    const { onJoinBoard } = renderButton();
    await user.click(screen.getByRole("button", { name: "共有リンクで参加" }));
    expect(screen.getByRole("button", { name: "参加する" })).toBeDisabled();
    expect(onJoinBoard).not.toHaveBeenCalled();
  });

  it("空白だけでも参加できない", async () => {
    renderButton();
    await user.click(screen.getByRole("button", { name: "共有リンクで参加" }));
    await user.type(screen.getByRole("textbox"), "   ");
    expect(screen.getByRole("button", { name: "参加する" })).toBeDisabled();
  });

  it("参加中は二重に押せない", async () => {
    let resolve: (r: "member") => void = () => {};
    const onJoinBoard = vi.fn(
      () => new Promise<"member">((r) => (resolve = r)),
    );
    renderButton(onJoinBoard);
    await join("abc123");

    expect(screen.getByRole("button", { name: "参加中…" })).toBeDisabled();
    resolve("member");
    await waitFor(() => expect(onJoinBoard).toHaveBeenCalledTimes(1));
  });

  it("キャンセルすると閉じ、参加しない", async () => {
    const { onJoinBoard } = renderButton();
    await user.click(screen.getByRole("button", { name: "共有リンクで参加" }));
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(onJoinBoard).not.toHaveBeenCalled();
  });
});
