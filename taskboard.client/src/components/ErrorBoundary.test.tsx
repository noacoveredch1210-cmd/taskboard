import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorBoundary from "./ErrorBoundary";

const Boom = () => {
  throw new Error("描画中の例外");
};

// React は捕捉した例外を console.error にも出す。テスト出力を汚さないよう黙らせる。
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("ErrorBoundary", () => {
  it("例外が無ければ子をそのまま描画する", () => {
    render(
      <ErrorBoundary>
        <div>アプリ本体</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("アプリ本体")).toBeInTheDocument();
  });

  it("描画中に例外が出ても、白画面にせずエラー画面を出す", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText("問題が発生しました")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "再読み込み" }),
    ).toBeInTheDocument();
  });

  it("再読み込みの導線を残す", async () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload },
      configurable: true,
    });

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    await userEvent.click(screen.getByRole("button", { name: "再読み込み" }));

    expect(reload).toHaveBeenCalled();
  });

  it("開発者向けに例外を記録する", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    const logged = consoleError.mock.calls.some(
      (args: unknown[]) => args[0] === "画面の描画に失敗しました",
    );
    expect(logged).toBe(true);
  });
});
