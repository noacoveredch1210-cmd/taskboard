import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateCategoryModal from "./CreateCategoryModal";

const nameInput = () =>
  screen.getByPlaceholderText("カテゴリー名を入力...") as HTMLInputElement;

// 各テストごとに新しい user を用意し、入力状態がテスト間で漏れないようにする
let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
});

describe("CreateCategoryModal（新規）", () => {
  it("名前を入れて追加すると onCreateCategory を呼ぶ（既定色）", async () => {
    const onCreateCategory = vi.fn();
    const onClose = vi.fn();
    render(
      <CreateCategoryModal
        onCreateCategory={onCreateCategory}
        onClose={onClose}
      />,
    );
    await user.type(nameInput(), "仕事");
    await user.click(screen.getByText("追加"));
    expect(onCreateCategory).toHaveBeenCalledWith("仕事", "#349d36");
    expect(onClose).toHaveBeenCalled();
  });

  it("名前が空なら作成せず閉じる", async () => {
    const onCreateCategory = vi.fn();
    const onClose = vi.fn();
    render(
      <CreateCategoryModal
        onCreateCategory={onCreateCategory}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByText("追加"));
    expect(onCreateCategory).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe("CreateCategoryModal（編集）", () => {
  it("初期値を反映し、変更で onSetCategory を呼ぶ", async () => {
    const onSetCategory = vi.fn();
    const category = { id: "c1", name: "旧名", color: "#ff0000" };
    render(
      <CreateCategoryModal
        category={category}
        onSetCategory={onSetCategory}
        onClose={vi.fn()}
      />,
    );
    expect(nameInput().value).toBe("旧名");
    // 編集時のボタンラベルは「変更」
    await user.clear(nameInput());
    await user.type(nameInput(), "新名");
    await user.click(screen.getByText("変更"));
    expect(onSetCategory).toHaveBeenCalledWith("c1", {
      name: "新名",
      color: "#ff0000",
    });
  });
});
