import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TaskCardContent from "./TaskCardContent";
import type { TaskInfo } from "../../../../types/taskInfo";
import type { Category } from "../../../../types/category";

const task: TaskInfo = {
  id: "t1",
  name: "買い物",
  comment: "",
  importance: 2,
  categoryId: "c1",
  positionId: "p1",
  assigneeId: "",
  orderIndex: 0,
};

const category: Category = { id: "c1", name: "仕事", color: "#ff0000" };

const roleButton = (iconText: string) =>
  screen.getByText(iconText).closest('[role="button"]') as HTMLElement;

// 各テストごとに新しい user を用意し、入力状態がテスト間で漏れないようにする
let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
});

describe("TaskCardContent", () => {
  it("タスク名とカテゴリー名を表示する", () => {
    render(<TaskCardContent task={task} category={category} />);
    expect(screen.getByText("買い物")).toBeInTheDocument();
    expect(screen.getByText("仕事")).toBeInTheDocument();
  });

  it("カテゴリー・期限が未設定なら既定表示になる", () => {
    render(<TaskCardContent task={{ ...task, categoryId: "" }} />);
    expect(screen.getByText("未設定")).toBeInTheDocument();
    expect(screen.getByText("期限未設定")).toBeInTheDocument();
  });

  it("期限があるときは「期限未設定」を出さない", () => {
    render(
      <TaskCardContent
        task={{ ...task, deadline: new Date(2026, 6, 8) }}
        category={category}
      />,
    );
    expect(screen.queryByText("期限未設定")).not.toBeInTheDocument();
  });

  it("onDelete が無いときはメニューを開かない（オーバーレイ用途）", async () => {    render(<TaskCardContent task={task} category={category} />);
    await user.click(roleButton("more_horiz"));
    expect(screen.queryByText("削除")).not.toBeInTheDocument();
  });

  it("メニューから削除を選ぶと確認モーダルを経て onDelete を呼ぶ", async () => {    const onDelete = vi.fn();
    render(
      <TaskCardContent task={task} category={category} onDelete={onDelete} />,
    );
    await user.click(roleButton("more_horiz"));
    await user.click(screen.getByText("削除"));
    expect(screen.getByText("このタスクを削除しますか？")).toBeInTheDocument();
    await user.click(screen.getByText("はい"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("メニュー外をクリックすると閉じる", async () => {    render(
      <TaskCardContent task={task} category={category} onDelete={vi.fn()} />,
    );
    await user.click(roleButton("more_horiz"));
    expect(screen.getByText("削除")).toBeInTheDocument();
    await user.click(document.body); // メニュー外
    expect(screen.queryByText("削除")).not.toBeInTheDocument();
  });

  it("「進む」ボタンで onAdvancePosition を呼ぶ", async () => {    const onAdvancePosition = vi.fn();
    render(
      <TaskCardContent
        task={task}
        category={category}
        onAdvancePosition={onAdvancePosition}
      />,
    );
    await user.click(roleButton("arrow_forward"));
    expect(onAdvancePosition).toHaveBeenCalledTimes(1);
  });

  it("担当者がいれば期限の隣にアバターを表示する", () => {
    render(
      <TaskCardContent
        task={task}
        category={category}
        assignee={{ id: "u1", name: "太郎" }}
      />,
    );
    expect(screen.getByLabelText("太郎")).toBeInTheDocument();
  });

  it("担当者が未設定ならアバターを表示しない", () => {
    render(<TaskCardContent task={task} category={category} />);
    expect(screen.queryByLabelText("太郎")).not.toBeInTheDocument();
  });
});
