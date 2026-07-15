import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./components/home/HomePage", () => ({
  default: () => <div>ホーム</div>,
}));
vi.mock("./components/board/BoardPage", () => ({
  default: ({ boardInfo }: { boardInfo: { title: string } }) => (
    <div>ボード: {boardInfo.title}</div>
  ),
}));

import Pages from "./index";
import type { BoardInfo } from "../../types/boardInfo";

const boards: BoardInfo[] = [
  {
    id: "b1",
    shortName: "A",
    title: "ボードA",
    role: "owner",
    positions: [],
    categories: [],
  },
  {
    id: "b2",
    shortName: "B",
    title: "ボードB",
    role: "owner",
    positions: [],
    categories: [],
  },
];

const renderPages = (openingPageIndex: number | null) =>
  render(
    <Pages
      userInfo={{ name: "山田太郎", email: "taro@example.com" }}
      boards={boards}
      openingPageIndex={openingPageIndex}
      onSaveTask={vi.fn()}
      onSetCategory={vi.fn()}
      onCreateCategory={vi.fn()}
      onDeleteCategories={vi.fn()}
      onSetBoard={vi.fn()}
      onCreateBoard={vi.fn()}
      onDeleteBoards={vi.fn()}
      onReorderTasks={vi.fn()}
      onCommitTaskMove={vi.fn()}
      onDeleteTasks={vi.fn()}
      onGetShareLink={vi.fn()}
      onJoinBoard={vi.fn()}
      onLeaveBoard={vi.fn()}
      onRestoreTask={vi.fn()}
    />,
  );

describe("Pages", () => {
  it("openingPageIndex が null ならホーム画面を出す", () => {
    renderPages(null);

    expect(screen.getByText("ホーム")).toBeInTheDocument();
    expect(screen.queryByText(/^ボード:/)).not.toBeInTheDocument();
  });

  it("openingPageIndex が指す board を開く", () => {
    renderPages(1);

    expect(screen.getByText("ボード: ボードB")).toBeInTheDocument();
    expect(screen.queryByText("ホーム")).not.toBeInTheDocument();
  });

  it("先頭の board（index 0）でもホーム画面と取り違えない", () => {
    // 0 は falsy なので、null との判定を取り違えると壊れる。
    renderPages(0);

    expect(screen.getByText("ボード: ボードA")).toBeInTheDocument();
  });
});
