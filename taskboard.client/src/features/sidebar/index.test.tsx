import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Sidebar from "./index";
import type { BoardInfo } from "../../types/boardInfo";

const boards: BoardInfo[] = [
  { id: "b1", shortName: "AA", title: "ボードA", role: "owner", positions: [], categories: [] },
  { id: "b2", shortName: "BB", title: "ボードB", role: "owner", positions: [], categories: [] },
];

const button = (label: string) =>
  screen.getByText(label).closest("button") as HTMLButtonElement;

const renderSidebar = (
  over: Partial<React.ComponentProps<typeof Sidebar>> = {},
) =>
  render(
    <Sidebar
      boards={boards}
      openingPageIndex={null}
      isOpen={true}
      setOpeningPageIndex={vi.fn()}
      toggleSidebar={vi.fn()}
      {...over}
    />,
  );

// 各テストごとに新しい user を用意し、入力状態がテスト間で漏れないようにする
let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
});

describe("Sidebar", () => {
  it("Home と board 数だけボタンを表示する", () => {
    renderSidebar();
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("AA")).toBeInTheDocument();
    expect(screen.getByText("BB")).toBeInTheDocument();
  });

  it("Home ボタンで setOpeningPageIndex(null) を呼ぶ", async () => {    const set = vi.fn();
    renderSidebar({ openingPageIndex: 0, setOpeningPageIndex: set });
    await user.click(button("Home"));
    expect(set).toHaveBeenCalledWith(null);
  });

  it("board ボタンでその index を渡す", async () => {    const set = vi.fn();
    renderSidebar({ setOpeningPageIndex: set });
    await user.click(button("BB"));
    expect(set).toHaveBeenCalledWith(1);
  });

  it("閉じるボタンで toggleSidebar を呼ぶ", async () => {    const toggle = vi.fn();
    renderSidebar({ toggleSidebar: toggle });
    await user.click(button("close"));
    expect(toggle).toHaveBeenCalledTimes(1);
  });
});
