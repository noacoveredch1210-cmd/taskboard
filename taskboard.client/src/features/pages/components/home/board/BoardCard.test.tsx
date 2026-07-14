import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BoardCard from "./BoardCard";
import type { BoardInfo, BoardRole } from "../../../../../types/boardInfo";

const board = (role: BoardRole): BoardInfo => ({
  id: "b1",
  shortName: "AA",
  title: "ボードA",
  role,
  positions: [{ id: "p1", name: "Todo" }],
  categories: [],
});

let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => {
  user = userEvent.setup();
});

const renderCard = (role: BoardRole, isSelectMode = true) => {
  const onToggleSelect = vi.fn();
  render(
    <BoardCard
      boardInfo={board(role)}
      isSelectMode={isSelectMode}
      checked={false}
      onToggleSelect={onToggleSelect}
      onSetBoard={vi.fn()}
    />,
  );
  return { onToggleSelect };
};

describe("BoardCard の選択（削除はオーナーのみ）", () => {
  it("オーナーは選択チェックボックスを操作できる", async () => {
    const { onToggleSelect } = renderCard("owner");

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeEnabled();
    await user.click(checkbox);

    expect(onToggleSelect).toHaveBeenCalledWith("b1");
  });

  it("メンバーはチェックボックスが無効で選択できない", async () => {
    const { onToggleSelect } = renderCard("member");

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeDisabled();
    await user.click(checkbox);

    expect(onToggleSelect).not.toHaveBeenCalled();
  });

  it("メンバーは選択モードでカードを押しても選択されない", async () => {
    const { onToggleSelect } = renderCard("member");

    // カード本体（略称セル）をクリック
    await user.click(screen.getByText("AA"));

    expect(onToggleSelect).not.toHaveBeenCalled();
  });

  it("オーナーはカードクリックで編集モーダルを開ける", async () => {
    renderCard("owner", false);

    await user.click(screen.getByText("AA"));

    expect(screen.getByText("board 編集")).toBeInTheDocument();
  });

  it("メンバーはカードクリックしても編集モーダルを開けない", async () => {
    renderCard("member", false);

    await user.click(screen.getByText("AA"));

    expect(screen.queryByText("board 編集")).not.toBeInTheDocument();
  });
});
