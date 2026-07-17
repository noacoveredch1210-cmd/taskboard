import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  loadTrash: vi.fn(),
  purge: vi.fn(),
  purgeAll: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("../../../../api/board-data", () => ({ loadTrash: mocks.loadTrash }));
vi.mock("../../../../api/tasks", () => ({
  tasksApi: { purge: mocks.purge, purgeAll: mocks.purgeAll },
}));
vi.mock("../../../../components/toast/ToastContext", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

import TrashModal from "./TrashModal";
import type { BoardInfo } from "../../../../types/boardInfo";
import type { TaskInfo } from "../../../../types/taskInfo";

const boardInfo: BoardInfo = {
  id: "board-1",
  shortName: "B",
  title: "ボード",
  role: "owner",
  positions: [],
  categories: [],
};

const task = (id: string, name: string): TaskInfo => ({
  id,
  name,
  comment: "",
  importance: 0,
  categoryId: "",
  positionId: "",
  assigneeId: "",
});

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  vi.clearAllMocks();
  user = userEvent.setup();
  mocks.purge.mockResolvedValue(undefined);
  mocks.purgeAll.mockResolvedValue(undefined);
});

const renderTrash = (onRestoreTask = vi.fn().mockResolvedValue(true)) => {
  render(
    <TrashModal
      boardInfo={boardInfo}
      onClose={vi.fn()}
      onRestoreTask={onRestoreTask}
    />,
  );
  return { onRestoreTask };
};

describe("TrashModal", () => {
  it("ゴミ箱のタスクを一覧表示する", async () => {
    mocks.loadTrash.mockResolvedValue([task("t1", "消したタスク")]);
    renderTrash();
    expect(await screen.findByText("消したタスク")).toBeInTheDocument();
  });

  it("空なら「ゴミ箱は空です。」を表示する", async () => {
    mocks.loadTrash.mockResolvedValue([]);
    renderTrash();
    expect(await screen.findByText("ゴミ箱は空です。")).toBeInTheDocument();
  });

  it("元に戻すと onRestoreTask を呼び、一覧から消える", async () => {
    mocks.loadTrash.mockResolvedValue([task("t1", "復元するタスク")]);
    const { onRestoreTask } = renderTrash();
    await screen.findByText("復元するタスク");

    await user.click(screen.getByRole("button", { name: "元に戻す" }));

    await waitFor(() =>
      expect(onRestoreTask).toHaveBeenCalledWith(
        "board-1",
        expect.objectContaining({ id: "t1" }),
      ),
    );
    expect(screen.queryByText("復元するタスク")).not.toBeInTheDocument();
  });

  it("完全に削除は確認を経て purge を呼ぶ", async () => {
    mocks.loadTrash.mockResolvedValue([task("t1", "完全削除するタスク")]);
    renderTrash();
    await screen.findByText("完全削除するタスク");

    await user.click(
      screen.getByRole("button", { name: "完全削除するタスク を完全に削除" }),
    );
    await user.click(screen.getByRole("button", { name: "完全に削除" }));

    await waitFor(() => expect(mocks.purge).toHaveBeenCalledWith("t1"));
    expect(screen.queryByText("完全削除するタスク")).not.toBeInTheDocument();
  });

  it("ゴミ箱を空にするは確認を経て purgeAll を呼び、一覧を空にする", async () => {
    mocks.loadTrash.mockResolvedValue([task("t1", "A"), task("t2", "B")]);
    renderTrash();
    await screen.findByText("A");

    await user.click(screen.getByRole("button", { name: "ゴミ箱を空にする" }));
    await user.click(screen.getByRole("button", { name: "すべて削除" }));

    await waitFor(() => expect(mocks.purgeAll).toHaveBeenCalledWith("board-1"));
    expect(await screen.findByText("ゴミ箱は空です。")).toBeInTheDocument();
  });
});
