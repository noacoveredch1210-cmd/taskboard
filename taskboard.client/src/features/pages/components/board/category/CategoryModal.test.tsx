import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CategoryModal from "./CategoryModal";
import type { BoardInfo } from "../../../../../types/boardInfo";
import type { Category } from "../../../../../types/category";

const categories: Category[] = [
  { id: "c1", name: "開発", color: "#4F7C7E" },
  { id: "c2", name: "設計", color: "#5B7DB1" },
];

const boardInfo: BoardInfo = {
  id: "board-1",
  shortName: "B",
  title: "ボード",
  role: "owner",
  positions: [],
  categories,
};

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  vi.clearAllMocks();
  user = userEvent.setup();
});

const renderModal = (overrides: Partial<Parameters<typeof CategoryModal>[0]> = {}) => {
  const props = {
    categories,
    boardInfo,
    onSetCategory: vi.fn(),
    onCreateCategory: vi.fn(),
    onDeleteCategories: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<CategoryModal {...props} />);
  return props;
};

describe("CategoryModal（一覧・作成）", () => {
  it("カテゴリーを一覧表示する", () => {
    renderModal();
    expect(screen.getByText("カテゴリー管理")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /開発/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /設計/ })).toBeInTheDocument();
  });

  it("追加ボタンで作成モーダルを開き、boardId を補って作成する", async () => {
    const { onCreateCategory } = renderModal();
    await user.click(screen.getByRole("button", { name: "カテゴリーを追加" }));

    await user.type(
      screen.getByPlaceholderText("カテゴリー名を入力..."),
      "テスト",
    );
    await user.click(screen.getByRole("button", { name: "追加" }));

    // 子は boardId を知らないので、ここで補う
    await waitFor(() =>
      expect(onCreateCategory).toHaveBeenCalledWith(
        "board-1",
        "テスト",
        expect.any(String),
      ),
    );
  });
});

describe("CategoryModal（選択して削除）", () => {
  it("選択して削除すると、確認のうえ選んだ ID だけ渡す", async () => {
    const { onDeleteCategories } = renderModal();
    await user.click(screen.getByRole("button", { name: "選択" }));

    // 「開発」だけ選ぶ
    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: "delete" }));
    await user.click(screen.getByRole("button", { name: "はい" }));

    expect(onDeleteCategories).toHaveBeenCalledWith(["c1"]);
  });

  it("確認をキャンセルすると削除しない", async () => {
    const { onDeleteCategories } = renderModal();
    await user.click(screen.getByRole("button", { name: "選択" }));
    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: "delete" }));
    await user.click(screen.getByRole("button", { name: "いいえ" }));

    expect(onDeleteCategories).not.toHaveBeenCalled();
  });

  it("選択モードを抜けると選択が消える", async () => {
    renderModal();
    await user.click(screen.getByRole("button", { name: "選択" }));
    await user.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.getAllByRole("checkbox")[0]).toBeChecked();

    // 選択モードを抜けて、もう一度入る
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    await user.click(screen.getByRole("button", { name: "選択" }));
    expect(screen.getAllByRole("checkbox")[0]).not.toBeChecked();
  });

  // 一覧の外側をクリックしたら選択モードを解除する、という意図の実装がある。
  it("一覧の外側をクリックすると選択モードが解除される", async () => {
    renderModal();
    await user.click(screen.getByRole("button", { name: "選択" }));
    expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0);

    // 一覧（rootRef）の外＝モーダルの見出しをクリックする
    await user.click(screen.getByText("カテゴリー管理"));

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});
