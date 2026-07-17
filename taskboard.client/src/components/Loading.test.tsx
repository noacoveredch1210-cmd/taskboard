import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import Loading from "./Loading";

afterEach(() => {
  vi.useRealTimers();
});

describe("Loading", () => {
  it("読み込み中であることを表示する", () => {
    render(<Loading />);

    expect(screen.getByText("Now Loading")).toBeInTheDocument();
  });

  // サーバーは無料枠でコールドスタートするので、遅いときは理由を出す。
  // 逆に、普段のロードでこれが出ると「毎回 30 秒かかる」と誤解される。
  it("すぐ読み込めたときは、起動中の案内を出さない", () => {
    vi.useFakeTimers();
    render(<Loading />);

    expect(screen.queryByText(/サーバーを起動しています/)).not.toBeInTheDocument();
  });

  it("待たされたら、サーバー起動中であることを伝える", () => {
    vi.useFakeTimers();
    render(<Loading />);

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.getByText(/サーバーを起動しています/)).toBeInTheDocument();
  });
});
