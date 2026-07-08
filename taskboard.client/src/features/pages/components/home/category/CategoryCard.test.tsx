import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CategoryCard from "./CategoryCard";

const category = { id: "c1", name: "仕事", color: "#ff0000" };

// 各テストごとに新しい user を用意し、入力状態がテスト間で漏れないようにする
let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
});

describe("CategoryCard", () => {
  it("カテゴリー名を表示する", () => {
    render(
      <CategoryCard
        category={category}
        isSelectMode={false}
        checked={false}
        onToggleSelect={vi.fn()}
        onSetCategory={vi.fn()}
      />,
    );
    expect(screen.getByText("仕事")).toBeInTheDocument();
  });

  it("通常時クリックで編集モーダルを開く", async () => {    render(
      <CategoryCard
        category={category}
        isSelectMode={false}
        checked={false}
        onToggleSelect={vi.fn()}
        onSetCategory={vi.fn()}
      />,
    );
    await user.click(screen.getByText("仕事").closest("button")!);
    expect(screen.getByText("カテゴリーを追加")).toBeInTheDocument(); // 見出し
    expect(screen.getByText("変更")).toBeInTheDocument(); // 編集時ボタン
  });

  it("選択モードのクリックは onToggleSelect を呼ぶ", async () => {    const onToggleSelect = vi.fn();
    render(
      <CategoryCard
        category={category}
        isSelectMode={true}
        checked={false}
        onToggleSelect={onToggleSelect}
        onSetCategory={vi.fn()}
      />,
    );
    await user.click(screen.getByText("仕事").closest("button")!);
    expect(onToggleSelect).toHaveBeenCalledWith("c1");
  });
});
