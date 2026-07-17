import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// カテゴリー管理・共有ツールバーは BoardPage の関心事ではない（別途テスト）。
// useToast など文脈依存を持ち込まないようスタブ化する。
vi.mock("./BoardToolbar", () => ({ default: () => <div>ツールバー</div> }));

import BoardPage from "./BoardPage";
import type { BoardInfo } from "../../../../types/boardInfo";
import type { TaskInfo } from "../../../../types/taskInfo";
import type { Category } from "../../../../types/category";

// ---- テスト用データ ----

const categories: Category[] = [
  { id: "c1", name: "仕事", color: "#ff0000" },
  { id: "c2", name: "私用", color: "#00ff00" },
];

const makeTask = (over: Partial<TaskInfo>): TaskInfo => ({
  id: "t",
  name: "task",
  comment: "",
  importance: 0,
  categoryId: "",
  positionId: "p1",
  assigneeId: "",
  ...over,
});

// 全タスクを 1 コンテナに入れ、表示順の検証を簡単にする
const tasks: TaskInfo[] = [
  makeTask({ id: "a", name: "Alpha", importance: 1, categoryId: "c1" }),
  makeTask({ id: "b", name: "Beta", importance: 3, categoryId: "c2" }),
  makeTask({ id: "c", name: "Gamma", importance: 2, comment: "至急対応" }),
];

const boardInfo: BoardInfo = {
  id: "board-1",
  shortName: "B",
  title: "テストボード",
  role: "owner",
  positions: [{ id: "p1", name: "Todo" }],
  categories,
  tasks,
};

const renderBoard = () =>
  render(
    <BoardPage
      boardInfo={boardInfo}
      onSaveTask={vi.fn()}
      onCreateCategory={vi.fn()}
      onSetCategory={vi.fn()}
      onDeleteCategories={vi.fn()}
      onReorderTasks={vi.fn()}
      onCommitTaskMove={vi.fn()}
      onDeleteTasks={vi.fn()}
      onGetShareLink={vi.fn()}
      onLeaveBoard={vi.fn()}
      onRestoreTask={vi.fn()}
    />,
  );

const renderRole = (role: "owner" | "member") =>
  render(
    <BoardPage
      boardInfo={{ ...boardInfo, role }}
      onSaveTask={vi.fn()}
      onCreateCategory={vi.fn()}
      onSetCategory={vi.fn()}
      onDeleteCategories={vi.fn()}
      onReorderTasks={vi.fn()}
      onCommitTaskMove={vi.fn()}
      onDeleteTasks={vi.fn()}
      onGetShareLink={vi.fn()}
      onLeaveBoard={vi.fn()}
      onRestoreTask={vi.fn()}
    />,
  );

/** name1 が name2 より DOM 上で前に描画されているか */
const isBefore = (name1: string, name2: string): boolean => {
  const a = screen.getByText(name1);
  const b = screen.getByText(name2);
  return Boolean(
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
};

// 各テストごとに新しい user を用意し、入力状態がテスト間で漏れないようにする
let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
});

describe("BoardPage（タスク削除はオーナーのみ）", () => {
  it("オーナーには削除の選択ボタンが出る", () => {
    renderRole("owner");
    expect(screen.getByText("選択")).toBeInTheDocument();
  });

  it("メンバーには削除の選択ボタンが出ない", () => {
    renderRole("member");
    expect(screen.queryByText("選択")).not.toBeInTheDocument();
  });
});

describe("BoardPage", () => {
  it("初期表示では全タスクを配列順に表示する", () => {
    renderBoard();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
    expect(isBefore("Alpha", "Beta")).toBe(true);
    expect(isBefore("Beta", "Gamma")).toBe(true);
  });

  describe("検索", () => {
    it("タスク名の部分一致で絞り込む", async () => {
      renderBoard();
      await user.type(
        screen.getByPlaceholderText("タスク名・コメントで検索..."),
        "alph", // 大文字小文字は無視
      );
      expect(screen.getByText("Alpha")).toBeInTheDocument();
      expect(screen.queryByText("Beta")).not.toBeInTheDocument();
      expect(screen.queryByText("Gamma")).not.toBeInTheDocument();
    });

    it("コメントの部分一致でも絞り込む", async () => {
      renderBoard();
      await user.type(
        screen.getByPlaceholderText("タスク名・コメントで検索..."),
        "至急",
      );
      expect(screen.getByText("Gamma")).toBeInTheDocument();
      expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    });
  });

  describe("絞り込み", () => {
    it("重要度で絞り込む", async () => {
      renderBoard();
      await user.selectOptions(
        screen.getByDisplayValue("フィルターなし"),
        "importance",
      );
      await user.selectOptions(screen.getByDisplayValue("選択..."), "3");
      expect(screen.getByText("Beta")).toBeInTheDocument(); // importance 3
      expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
      expect(screen.queryByText("Gamma")).not.toBeInTheDocument();
    });

    it("カテゴリーで絞り込む", async () => {
      renderBoard();
      await user.selectOptions(
        screen.getByDisplayValue("フィルターなし"),
        "category",
      );
      await user.selectOptions(screen.getByDisplayValue("選択..."), "c1");
      expect(screen.getByText("Alpha")).toBeInTheDocument(); // categoryId c1
      expect(screen.queryByText("Beta")).not.toBeInTheDocument();
    });
  });

  describe("並び替え", () => {
    it("重要度-高で降順に並べる", async () => {
      renderBoard();
      await user.selectOptions(
        screen.getByDisplayValue("並び替えなし"),
        "importance-desc",
      );
      // Beta(3) → Gamma(2) → Alpha(1)
      expect(isBefore("Beta", "Gamma")).toBe(true);
      expect(isBefore("Gamma", "Alpha")).toBe(true);
    });

    it("重要度-低で昇順に並べる", async () => {
      renderBoard();
      await user.selectOptions(
        screen.getByDisplayValue("並び替えなし"),
        "importance-asc",
      );
      // Alpha(1) → Gamma(2) → Beta(3)
      expect(isBefore("Alpha", "Gamma")).toBe(true);
      expect(isBefore("Gamma", "Beta")).toBe(true);
    });
  });
});

// ---- ドラッグを伴わないクリック操作（進む/選択削除/モーダル） ----

// p1(先頭・末尾でない) と p2(末尾) の 2 コンテナ構成。
// A は p1、B は p2 に置く。
const twoColBoard: BoardInfo = {
  id: "board-2",
  shortName: "B",
  title: "2列ボード",
  role: "owner",
  positions: [
    { id: "p1", name: "Todo" },
    { id: "p2", name: "Done" },
  ],
  categories,
  tasks: [
    makeTask({ id: "a", name: "A", positionId: "p1" }),
    makeTask({ id: "b", name: "B", positionId: "p2" }),
  ],
};

const renderTwoCol = () => {
  const onReorderTasks = vi.fn();
  const onCommitTaskMove = vi.fn();
  const onDeleteTasks = vi.fn();
  const onSaveTask = vi.fn();
  render(
    <BoardPage
      boardInfo={twoColBoard}
      onSaveTask={onSaveTask}
      onCreateCategory={vi.fn()}
      onSetCategory={vi.fn()}
      onDeleteCategories={vi.fn()}
      onReorderTasks={onReorderTasks}
      onCommitTaskMove={onCommitTaskMove}
      onDeleteTasks={onDeleteTasks}
      onGetShareLink={vi.fn()}
      onLeaveBoard={vi.fn()}
      onRestoreTask={vi.fn()}
    />,
  );
  return { onReorderTasks, onCommitTaskMove, onDeleteTasks, onSaveTask };
};

/** 「＋」は各列にあるので、列の番号で選ぶ。 */
const clickAddButtonOfColumn = (index: number) =>
  user.click(screen.getAllByText("add")[index].closest("button")!);

describe("BoardPage（クリック操作）", () => {
  it("「進む」で次の position へ移動し保存する", async () => {
    const { onReorderTasks, onCommitTaskMove } = renderTwoCol();
    // 末尾でない p1 のタスクにだけ「進む」ボタン(arrow_forward)が出る
    await user.click(
      screen.getByText("arrow_forward").closest('[role="button"]')!,
    );

    expect(onReorderTasks).toHaveBeenCalledTimes(1);
    const [boardId, next] = onReorderTasks.mock.calls[0] as [
      string,
      TaskInfo[],
    ];
    expect(boardId).toBe("board-2");
    // A が p2 へ移動している
    expect(next.find((t) => t.id === "a")?.positionId).toBe("p2");
    expect(onCommitTaskMove).toHaveBeenCalledWith(
      "board-2",
      "a",
      expect.any(Array),
      expect.any(Array),
    );

    // 4 番目の引数は巻き戻し用の「移動前の並び」で、A はまだ p1 にいる。
    const tasksBeforeMove = onCommitTaskMove.mock.calls[0][3] as TaskInfo[];
    expect(tasksBeforeMove.find((t) => t.id === "a")?.positionId).toBe("p1");
  });

  it("末尾コンテナで選択して削除すると onDeleteTasks を呼ぶ", async () => {
    const { onDeleteTasks } = renderTwoCol();
    await user.click(screen.getByText("選択")); // 末尾コンテナを選択モードへ
    await user.click(screen.getByText("B").closest("button")!); // B を選択
    expect(screen.getByText("1個のアイテムを選択中")).toBeInTheDocument();

    await user.click(screen.getByText("delete").closest("button")!);
    expect(
      screen.getByText("選択したタスクを削除しますか？"),
    ).toBeInTheDocument();
    await user.click(screen.getByText("はい"));
    expect(onDeleteTasks).toHaveBeenCalledWith("board-2", ["b"]);
  });

  it("タスクをクリックすると編集モーダルが開く", async () => {
    renderTwoCol();
    await user.click(screen.getByText("A").closest("button")!);
    const input = screen.getByPlaceholderText(
      "タスク名を入力...",
    ) as HTMLInputElement;
    expect(input.value).toBe("A");
  });

  it("＋ボタンで新規タスク作成モーダルが開く", async () => {
    renderTwoCol();
    await clickAddButtonOfColumn(0);
    const input = screen.getByPlaceholderText(
      "タスク名を入力...",
    ) as HTMLInputElement;
    expect(input.value).toBe(""); // 新規なので空
  });

  // 「＋」は各列にある。押した列が既定になっていないと、
  // 2 列目で追加したのに 1 列目へ入ってしまう。
  it("押した列が新規タスクの position の既定になる", async () => {
    const { onSaveTask } = renderTwoCol();

    // 2 列目（Done）の「＋」から追加する
    await clickAddButtonOfColumn(1);
    await user.type(screen.getByPlaceholderText("タスク名を入力..."), "新規");
    await user.click(screen.getByText("保存"));

    expect(onSaveTask).toHaveBeenCalledTimes(1);
    const [, task] = onSaveTask.mock.calls[0] as [string, TaskInfo];
    expect(task.positionId).toBe("p2");
  });
});
