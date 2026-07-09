import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorScreen from "./ErrorScreen";

describe("ErrorScreen", () => {
  it("失敗の内容と再読み込みの導線を出す", () => {
    render(<ErrorScreen onRetry={vi.fn()} />);

    expect(screen.getByText("データを取得できませんでした")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "再読み込み" }),
    ).toBeInTheDocument();
  });

  it("再読み込みを押すと onRetry を呼ぶ", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorScreen onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: "再読み込み" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
