import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TaskModal from "./TaskModal";
import type { TaskInfo } from "../../../../types/taskInfo";
import type { Category } from "../../../../types/category";

const categories: Category[] = [{ id: "c1", name: "仕事", color: "#ff0000" }];

const renderNew = () => {
  const onSaveTask = vi.fn();
  const onClose = vi.fn();
  render(
    <TaskModal
      boardId="b1"
      positionId="p1"
      positionName="Todo"
      categories={categories}
      onSaveTask={onSaveTask}
      onCreateCategory={vi.fn()}
      onClose={onClose}
    />,
  );
  return { onSaveTask, onClose };
};

// 各テストごとに新しい user を用意し、入力状態がテスト間で漏れないようにする
let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
});

describe("TaskModal（新規）", () => {
  it("名前が空なら保存しない（閉じるだけ）", async () => {    const { onSaveTask, onClose } = renderNew();
    await user.click(screen.getByText("保存"));
    expect(onSaveTask).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("名前・重要度を入力して保存すると onSaveTask を呼ぶ", async () => {    const { onSaveTask } = renderNew();
    await user.type(screen.getByPlaceholderText("タスク名を入力..."), "買い物");
    // combobox は [0]=重要度, [1]=カテゴリー
    const [importance, category] = screen.getAllByRole("combobox");
    await user.selectOptions(importance, "2");
    await user.selectOptions(category, "c1");

    await user.click(screen.getByText("保存"));
    expect(onSaveTask).toHaveBeenCalledTimes(1);
    const [boardId, task] = onSaveTask.mock.calls[0] as [string, TaskInfo];
    expect(boardId).toBe("b1");
    expect(task).toMatchObject({
      name: "買い物",
      importance: 2,
      categoryId: "c1",
      positionId: "p1",
    });
  });

  it("カテゴリー追加ボタンで CategoryModal を開く", async () => {    renderNew();
    await user.click(screen.getByText("add").closest("button")!);
    expect(screen.getByText("カテゴリーを追加")).toBeInTheDocument();
  });

  it("開いた CategoryModal は閉じられる", async () => {    renderNew();
    await user.click(screen.getByText("add").closest("button")!);
    // 空名で「追加」→ 作成せず閉じる（onClose 経由で非表示）
    await user.click(screen.getByText("追加"));
    expect(screen.queryByText("カテゴリーを追加")).not.toBeInTheDocument();
  });

  it("コメントと期限を入力して保存する", async () => {    const { onSaveTask } = renderNew();
    await user.type(screen.getByPlaceholderText("タスク名を入力..."), "買い物");
    await user.type(
      screen.getByPlaceholderText("説明・コメントを入力..."),
      "牛乳を買う",
    );
    // date input は userEvent.type と相性が悪いため change で直接設定する
    const dateInput = document.querySelector(
      'input[type="date"]',
    ) as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2026-07-08" } });

    await user.click(screen.getByText("保存"));
    const [, savedTask] = onSaveTask.mock.calls[0] as [string, TaskInfo];
    expect(savedTask.comment).toBe("牛乳を買う");
    // ローカルタイムの Date として解釈される（日ズレ防止）
    expect(savedTask.deadline?.getFullYear()).toBe(2026);
    expect(savedTask.deadline?.getMonth()).toBe(6); // 0-indexed → 7月
    expect(savedTask.deadline?.getDate()).toBe(8);
  });
});

describe("TaskModal（編集）", () => {
  it("既存タスクの初期値を反映し、更新して保存する", async () => {    const task: TaskInfo = {
      id: "t1",
      name: "既存",
      comment: "",
      importance: 3,
      categoryId: "c1",
      positionId: "p1",
      orderIndex: 0,
    };
    const onSaveTask = vi.fn();
    render(
      <TaskModal
        boardId="b1"
        task={task}
        positionName="Todo"
        categories={categories}
        onSaveTask={onSaveTask}
        onCreateCategory={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const nameInput = screen.getByPlaceholderText(
      "タスク名を入力...",
    ) as HTMLInputElement;
    expect(nameInput.value).toBe("既存");
    await user.clear(nameInput);
    await user.type(nameInput, "更新後");
    await user.click(screen.getByText("保存"));
    expect(onSaveTask).toHaveBeenCalledWith(
      "b1",
      expect.objectContaining({ id: "t1", name: "更新後", importance: 3 }),
    );
  });
});
