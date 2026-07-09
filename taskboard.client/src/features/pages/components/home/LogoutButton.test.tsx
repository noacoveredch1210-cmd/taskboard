import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  reportError: vi.fn(),
}));

vi.mock("../../../../auth/AuthContext", () => ({
  useAuth: () => ({ signOut: mocks.signOut }),
}));
vi.mock("../../../../hooks/reportError", () => ({
  reportError: (message: string) => (err: unknown) =>
    mocks.reportError(message, err),
}));

import LogoutButton from "./LogoutButton";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signOut.mockResolvedValue(undefined);
});

const openModal = async () => {
  const user = userEvent.setup();
  render(<LogoutButton />);
  await user.click(screen.getByRole("button", { name: "ログアウト" }));
  return user;
};

describe("LogoutButton", () => {
  it("最初は確認モーダルを出さない", () => {
    render(<LogoutButton />);

    expect(screen.queryByText("ログアウトしますか")).not.toBeInTheDocument();
  });

  it("ボタンを押すと確認モーダルを開く", async () => {
    await openModal();

    expect(screen.getByText("ログアウトしますか")).toBeInTheDocument();
    // 確認するだけで、まだサインアウトはしない。
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("「いいえ」ならサインアウトせずモーダルを閉じる", async () => {
    const user = await openModal();

    await user.click(screen.getByRole("button", { name: "いいえ" }));

    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(screen.queryByText("ログアウトしますか")).not.toBeInTheDocument();
  });

  it("「はい」ならサインアウトしてモーダルを閉じる", async () => {
    const user = await openModal();

    await user.click(screen.getByRole("button", { name: "はい" }));

    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("ログアウトしますか")).not.toBeInTheDocument();
  });

  it("サインアウトに失敗しても記録を残してモーダルは閉じる", async () => {
    const failure = new Error("boom");
    mocks.signOut.mockRejectedValue(failure);
    const user = await openModal();

    await user.click(screen.getByRole("button", { name: "はい" }));

    expect(screen.queryByText("ログアウトしますか")).not.toBeInTheDocument();
    // 失敗は非同期に届くため待つ。
    await vi.waitFor(() =>
      expect(mocks.reportError).toHaveBeenCalledWith(
        "ログアウトに失敗しました",
        failure,
      ),
    );
  });
});
