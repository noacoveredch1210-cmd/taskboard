import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BoardModal from "./BoardModal";
import type { BoardInfo } from "../../../../../types/boardInfo";

const titleInput = () => screen.getByPlaceholderText("board名を入力...");
const shortNameInput = () =>
  screen.getByPlaceholderText("board の short name を入力...");

// 各テストごとに新しい user を用意し、入力状態がテスト間で漏れないようにする
let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
});

describe("BoardModal（新規）", () => {
  it("既定の3ポジションで開く", () => {
    render(<BoardModal onCreateBoard={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("board 追加")).toBeInTheDocument();
    expect(screen.getByDisplayValue("未処理")).toBeInTheDocument();
    expect(screen.getByDisplayValue("処理中")).toBeInTheDocument();
    expect(screen.getByDisplayValue("完了")).toBeInTheDocument();
  });

  it("タイトルか略称が空なら作成しない（閉じるだけ）", async () => {    const onCreateBoard = vi.fn();
    const onClose = vi.fn();
    render(<BoardModal onCreateBoard={onCreateBoard} onClose={onClose} />);
    await user.click(screen.getByText("保存"));
    expect(onCreateBoard).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("入力して保存すると onCreateBoard を呼ぶ", async () => {    const onCreateBoard = vi.fn();
    render(<BoardModal onCreateBoard={onCreateBoard} onClose={vi.fn()} />);
    await user.type(titleInput(), "新ボード");
    await user.type(shortNameInput(), "NB");
    await user.click(screen.getByText("保存"));
    expect(onCreateBoard).toHaveBeenCalledTimes(1);
    const [title, shortName, positions] = onCreateBoard.mock.calls[0];
    expect(title).toBe("新ボード");
    expect(shortName).toBe("NB");
    expect(positions).toHaveLength(3);
  });

  it("Enter で position を追加できる", async () => {    render(<BoardModal onCreateBoard={vi.fn()} onClose={vi.fn()} />);
    await user.type(screen.getByPlaceholderText("+ positionを追加"), "レビュー{Enter}");
    expect(screen.getByDisplayValue("レビュー")).toBeInTheDocument();
  });

  it("position の削除は確認モーダルを経て反映される", async () => {    render(<BoardModal onCreateBoard={vi.fn()} onClose={vi.fn()} />);
    const card = screen.getByDisplayValue("処理中").closest("div")!;
    await user.click(within(card).getByText("close").closest("button")!);
    expect(screen.getByText("「処理中」を削除しますか？")).toBeInTheDocument();
    await user.click(screen.getByText("はい"));
    expect(screen.queryByDisplayValue("処理中")).not.toBeInTheDocument();
  });
});

describe("BoardModal（編集）", () => {
  it("既存 board の値を反映し、変更を onSetBoard に渡す", async () => {    const board: BoardInfo = {
      id: "b1",
      shortName: "OLD",
      title: "旧ボード",
      positions: [{ id: "p1", name: "Todo" }],
    };
    const onSetBoard = vi.fn();
    render(
      <BoardModal board={board} onSetBoard={onSetBoard} onClose={vi.fn()} />,
    );
    expect(screen.getByText("board 編集")).toBeInTheDocument();
    await user.clear(titleInput());
    await user.type(titleInput(), "新ボード");
    await user.click(screen.getByText("保存"));
    expect(onSetBoard).toHaveBeenCalledWith(
      "b1",
      expect.objectContaining({ title: "新ボード", shortName: "OLD" }),
    );
  });
});
