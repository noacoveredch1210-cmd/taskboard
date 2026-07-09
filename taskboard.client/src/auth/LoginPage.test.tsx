import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({ signInWithGoogle: vi.fn() }));

vi.mock("./AuthContext", () => ({
  useAuth: () => ({ signInWithGoogle: mocks.signInWithGoogle }),
}));

import LoginPage from "./LoginPage";

beforeEach(() => {
  vi.clearAllMocks();
});

const clickLogin = async () => {
  const user = userEvent.setup();
  render(<LoginPage />);
  await user.click(screen.getByRole("button", { name: /Google でログイン/ }));
  return user;
};

describe("LoginPage", () => {
  it("ボタンを押すと Google ログインを開始する", async () => {
    mocks.signInWithGoogle.mockResolvedValue(undefined);

    await clickLogin();

    expect(mocks.signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it("ログインに失敗したらエラーメッセージを表示する", async () => {
    mocks.signInWithGoogle.mockRejectedValue(new Error("boom"));

    await clickLogin();

    expect(
      await screen.findByText(
        "ログインに失敗しました。時間をおいて再度お試しください。",
      ),
    ).toBeInTheDocument();
  });

  it("再試行して成功したらエラーメッセージを消す", async () => {
    mocks.signInWithGoogle.mockRejectedValueOnce(new Error("boom"));
    const user = await clickLogin();

    const message =
      "ログインに失敗しました。時間をおいて再度お試しください。";
    expect(await screen.findByText(message)).toBeInTheDocument();

    mocks.signInWithGoogle.mockResolvedValueOnce(undefined);
    await user.click(screen.getByRole("button", { name: /Google でログイン/ }));

    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });

  it("最初はエラーメッセージを出さない", () => {
    render(<LoginPage />);

    expect(
      screen.queryByText(
        "ログインに失敗しました。時間をおいて再度お試しください。",
      ),
    ).not.toBeInTheDocument();
  });
});
