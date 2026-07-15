import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BoardView from "./BoardView";
import type { BoardInfo } from "../../../../../types/boardInfo";

const boards: BoardInfo[] = [
  {
    id: "b1",
    shortName: "AA",
    title: "ボードA",
    role: "owner",
    positions: [],
    categories: [],
  },
];

const renderView = (over = {}) => {
  const props = {
    boards,
    onSetBoard: vi.fn(),
    onCreateBoard: vi.fn(),
    onDeleteBoards: vi.fn(),
    ...over,
  };
  render(<BoardView {...props} />);
  return props;
};

// 各テストごとに新しい user を用意し、入力状態がテスト間で漏れないようにする
let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
});

describe("BoardView（＝汎用 View の選択・削除・作成フロー）", () => {
  it("board 一覧とタイトルを表示する", () => {
    renderView();
    expect(screen.getByText("board 管理")).toBeInTheDocument();
    expect(screen.getByText("ボードA")).toBeInTheDocument();
  });

  it("選択モードでチェックして削除すると onDeleteBoards を呼ぶ", async () => {
    const { onDeleteBoards } = renderView() as {
      onDeleteBoards: ReturnType<typeof vi.fn>;
    };
    await user.click(screen.getByText("選択")); // 選択モードへ
    await user.click(screen.getByRole("checkbox")); // board を選択
    expect(screen.getByText("1個のアイテムを選択中")).toBeInTheDocument();

    await user.click(screen.getByText("delete").closest("button")!); // 削除
    expect(
      screen.getByText("選択したboardを削除しますか？"),
    ).toBeInTheDocument();
    await user.click(screen.getByText("はい")); // 確定
    expect(onDeleteBoards).toHaveBeenCalledWith(["b1"]);
  });

  it("カードをクリックすると board 編集モーダルを開く", async () => {
    renderView();
    await user.click(screen.getByText("ボードA").closest("button")!);
    expect(screen.getByText("board 編集")).toBeInTheDocument();
  });
});
