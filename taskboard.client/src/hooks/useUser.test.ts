import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  loadUser: vi.fn(),
  reportError: vi.fn(),
}));

vi.mock("../api/board-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/board-data")>();
  return { ...actual, loadUser: mocks.loadUser };
});
vi.mock("./reportError", () => ({
  reportError: (message: string) => (err: unknown) =>
    mocks.reportError(message, err),
}));

import { useUser } from "./useUser";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useUser", () => {
  it("取得したユーザー情報を返す", async () => {
    mocks.loadUser.mockResolvedValue({
      name: "山田太郎",
      email: "taro@example.com",
    });

    const { result } = renderHook(() => useUser());

    await waitFor(() =>
      expect(result.current).toEqual({
        name: "山田太郎",
        email: "taro@example.com",
      }),
    );
  });

  it("取得前は空の値を返す（未定義を触らせない）", () => {
    mocks.loadUser.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useUser());

    expect(result.current).toEqual({ name: "", email: "" });
  });

  it("取得に失敗しても空の値のまま、記録だけ残す", async () => {
    const failure = new Error("boom");
    mocks.loadUser.mockRejectedValue(failure);

    const { result } = renderHook(() => useUser());

    await waitFor(() =>
      expect(mocks.reportError).toHaveBeenCalledWith(
        "ユーザー情報の取得に失敗しました",
        failure,
      ),
    );
    expect(result.current).toEqual({ name: "", email: "" });
  });
});
