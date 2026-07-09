import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// useCategories は API モジュールを直接呼ぶため、それぞれを差し替える。
const mocks = vi.hoisted(() => ({
  loadCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  removeCategory: vi.fn(),
  reportError: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("../api/board-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/board-data")>();
  return { ...actual, loadCategories: mocks.loadCategories };
});
vi.mock("../api/categories", () => ({
  categoriesApi: {
    create: mocks.createCategory,
    update: mocks.updateCategory,
    remove: mocks.removeCategory,
  },
}));
vi.mock("./reportError", () => ({
  reportError: (message: string) => (err: unknown) =>
    mocks.reportError(message, err),
}));
vi.mock("../components/toast/ToastContext", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

import { useCategories } from "./useCategories";
import type { Category } from "../types/category";

const category = (overrides: Partial<Category> & { id: string }): Category => ({
  name: "仕事",
  color: "#ff0000",
  ...overrides,
});

/** 初回ロードを済ませた状態のフックを返す。 */
const renderLoaded = async (categories: Category[] = []) => {
  mocks.loadCategories.mockResolvedValue(categories);
  const view = renderHook(() => useCategories());
  await waitFor(() =>
    expect(view.result.current.categories).toEqual(categories),
  );
  return view;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createCategory.mockResolvedValue(undefined);
  mocks.updateCategory.mockResolvedValue(undefined);
  mocks.removeCategory.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("初回ロード", () => {
  it("取得したカテゴリーを state に載せる", async () => {
    const { result } = await renderLoaded([category({ id: "c1" })]);

    expect(result.current.categories).toHaveLength(1);
  });

  it("取得に失敗したら記録だけ残し、空のまま続行する", async () => {
    const failure = new Error("network");
    mocks.loadCategories.mockRejectedValue(failure);

    const { result } = renderHook(() => useCategories());

    await waitFor(() =>
      expect(mocks.reportError).toHaveBeenCalledWith(
        "カテゴリーの取得に失敗しました",
        failure,
      ),
    );
    expect(result.current.categories).toEqual([]);
    // 初回ロードの失敗は board 側のエラー画面が受け持つため、通知は出さない。
    expect(mocks.showToast).not.toHaveBeenCalled();
  });
});

describe("createCategory", () => {
  it("生成した id で state に追加し、同じ id で API を呼ぶ", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "11111111-1111-4111-8111-111111111111",
    );
    const { result } = await renderLoaded([]);

    act(() => {
      result.current.createCategory("趣味", "#00ff00");
    });

    expect(result.current.categories).toEqual([
      { id: "11111111-1111-4111-8111-111111111111", name: "趣味", color: "#00ff00" },
    ]);
    expect(mocks.createCategory).toHaveBeenCalledWith({
      id: "11111111-1111-4111-8111-111111111111",
      name: "趣味",
      color: "#00ff00",
    });
  });

  it("作成に失敗したら通知し、サーバーの状態へ巻き戻す", async () => {
    const failure = new Error("boom");
    mocks.createCategory.mockRejectedValue(failure);
    // サーバーにはカテゴリーが無い状態を返させる。
    const { result } = await renderLoaded([]);

    await act(async () => {
      result.current.createCategory("趣味", "#00ff00");
    });

    // 楽観的に追加したカテゴリーは、再取得によって消える。
    expect(result.current.categories).toEqual([]);
    expect(mocks.showToast).toHaveBeenCalledWith(
      "カテゴリーの作成に失敗しました",
    );
    expect(mocks.reportError).toHaveBeenCalledWith(
      "カテゴリーの作成に失敗しました",
      failure,
    );
  });
});

describe("setCategory", () => {
  it("既存の値に更新分をマージして state と API へ反映する", async () => {
    const { result } = await renderLoaded([
      category({ id: "c1", name: "仕事", color: "#ff0000" }),
    ]);

    act(() => {
      result.current.setCategory("c1", { name: "私用" });
    });

    // 指定しなかった color は既存値が保たれる。
    expect(result.current.categories[0]).toEqual({
      id: "c1",
      name: "私用",
      color: "#ff0000",
    });
    expect(mocks.updateCategory).toHaveBeenCalledWith("c1", {
      name: "私用",
      color: "#ff0000",
    });
  });

  it("存在しない id なら何もしない", async () => {
    const { result } = await renderLoaded([category({ id: "c1" })]);

    act(() => {
      result.current.setCategory("unknown", { name: "私用" });
    });

    expect(mocks.updateCategory).not.toHaveBeenCalled();
    expect(result.current.categories[0].name).toBe("仕事");
  });

  it("更新に失敗したら通知し、サーバーの状態へ巻き戻す", async () => {
    const failure = new Error("boom");
    mocks.updateCategory.mockRejectedValue(failure);
    const original = category({ id: "c1", name: "仕事" });
    const { result } = await renderLoaded([original]);

    await act(async () => {
      result.current.setCategory("c1", { name: "私用" });
    });

    // 楽観的に書き換えた名前が、サーバーの値へ戻る。
    expect(result.current.categories[0].name).toBe("仕事");
    expect(mocks.showToast).toHaveBeenCalledWith(
      "カテゴリーの更新に失敗しました",
    );
    expect(mocks.reportError).toHaveBeenCalledWith(
      "カテゴリーの更新に失敗しました",
      failure,
    );
  });
});

describe("deleteCategories", () => {
  it("指定した id だけを state と API の両方から消す", async () => {
    const { result } = await renderLoaded([
      category({ id: "c1" }),
      category({ id: "c2" }),
      category({ id: "c3" }),
    ]);

    act(() => {
      result.current.deleteCategories(["c1", "c3"]);
    });

    expect(result.current.categories.map((c) => c.id)).toEqual(["c2"]);
    expect(mocks.removeCategory.mock.calls.map(([id]) => id)).toEqual([
      "c1",
      "c3",
    ]);
  });

  it("削除に失敗したら通知し、消したカテゴリーを再取得で復帰させる", async () => {
    const failure = new Error("boom");
    mocks.removeCategory.mockRejectedValue(failure);
    const { result } = await renderLoaded([category({ id: "c1" })]);

    await act(async () => {
      result.current.deleteCategories(["c1"]);
    });

    expect(result.current.categories.map((c) => c.id)).toEqual(["c1"]);
    expect(mocks.showToast).toHaveBeenCalledWith(
      "カテゴリーの削除に失敗しました",
    );
  });
});

describe("通信が切れていて再取得もできない場合", () => {
  it("作成を、操作前の状態へ巻き戻す", async () => {
    mocks.createCategory.mockRejectedValue(new Error("boom"));
    const { result } = await renderLoaded([category({ id: "c1" })]);

    // 巻き戻しのための再取得も失敗させる（通信断）。
    const refetchFailure = new Error("offline");
    mocks.loadCategories.mockRejectedValue(refetchFailure);

    await act(async () => {
      result.current.createCategory("趣味", "#00ff00");
    });

    // 再取得できなくても、操作前のカテゴリーだけが残る。
    expect(result.current.categories.map((c) => c.id)).toEqual(["c1"]);
    expect(mocks.showToast).toHaveBeenCalledWith(
      "カテゴリーの作成に失敗しました",
    );
    expect(mocks.reportError).toHaveBeenCalledWith(
      "最新の状態を取得できませんでした",
      refetchFailure,
    );
  });

  it("削除を、操作前の状態へ巻き戻す", async () => {
    mocks.removeCategory.mockRejectedValue(new Error("boom"));
    const { result } = await renderLoaded([category({ id: "c1" })]);
    mocks.loadCategories.mockRejectedValue(new Error("offline"));

    await act(async () => {
      result.current.deleteCategories(["c1"]);
    });

    expect(result.current.categories.map((c) => c.id)).toEqual(["c1"]);
  });
});
