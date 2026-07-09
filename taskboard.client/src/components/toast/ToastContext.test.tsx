import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast, TOAST_DURATION_MS } from "./ToastContext";

/** showToast を呼ぶだけのテスト用コンポーネント。 */
const Trigger = ({ message = "失敗しました" }: { message?: string }) => {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast(message)}>
      通知する
    </button>
  );
};

afterEach(() => {
  vi.useRealTimers();
});

describe("ToastProvider", () => {
  it("showToast を呼ぶと通知が表示される", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "通知する" }));

    expect(screen.getByRole("status")).toHaveTextContent("失敗しました");
  });

  it("閉じるボタンで通知を消せる", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: "通知する" }));
    await user.click(screen.getByRole("button", { name: "通知を閉じる" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("一定時間が過ぎると通知は自動的に消える", () => {
    // userEvent は内部で実タイマーを待つため、偽タイマー下では fireEvent を使う。
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "通知する" }));
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS);
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("複数の通知を積み重ねて表示する", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger message="1つ目" />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: "通知する" }));
    await user.click(screen.getByRole("button", { name: "通知する" }));

    expect(screen.getAllByRole("status")).toHaveLength(2);
  });

  it("通知が無いときも live region を DOM に残す（後から現れた領域は読み上げられない）", () => {
    const { container } = render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
  });

  it("Provider の外で useToast を使うと例外を投げる", () => {
    // React が投げるエラーをコンソールへ出さない
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Trigger />)).toThrow(
      "useToast は ToastProvider の内側で使ってください。",
    );

    spy.mockRestore();
  });
});
