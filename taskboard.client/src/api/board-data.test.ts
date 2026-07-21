import { describe, it, expect, vi, beforeEach } from "vitest";

// ローダーは API モジュールを直接呼ぶため、それぞれを差し替える。
const mocks = vi.hoisted(() => ({
  getMineBoards: vi.fn(),
  getCategoriesByBoard: vi.fn(),
  getMe: vi.fn(),
  getPositionsByBoard: vi.fn(),
  getTasksByBoard: vi.fn(),
  getMembers: vi.fn(),
}));

vi.mock("./boards", () => ({
  boardsApi: { getMine: mocks.getMineBoards, getMembers: mocks.getMembers },
}));
vi.mock("./categories", () => ({
  categoriesApi: { getByBoard: mocks.getCategoriesByBoard },
}));
vi.mock("./users", () => ({ usersApi: { getMe: mocks.getMe } }));
vi.mock("./positions", () => ({
  positionsApi: { getByBoard: mocks.getPositionsByBoard },
}));
vi.mock("./tasks", () => ({ tasksApi: { getByBoard: mocks.getTasksByBoard } }));

import {
  loadBoards,
  loadUser,
  toCreateTaskRequest,
  toUpdateTaskRequest,
} from "./board-data";
import type { TaskInfo } from "../types/taskInfo";
import type { BoardInfo } from "../types/boardInfo";
import type { BoardDto, TaskDto, PositionDto } from "./types";

/** BoardInfo.tasks は型上 optional だが、loadBoards は必ず設定する */
const tasksOf = (board: BoardInfo): TaskInfo[] => {
  expect(board.tasks).toBeDefined();
  return board.tasks!;
};

const baseTask: TaskInfo = {
  id: "task-1",
  name: "タスク名",
  comment: "コメント",
  importance: 2,
  deadline: new Date(2026, 6, 8), // ローカル 2026-07-08
  categoryId: "cat-1",
  positionId: "pos-1",
  assigneeId: "assignee-1",
};

const boardDto = (over: Partial<BoardDto> = {}): BoardDto => ({
  id: "board-1",
  userId: "user-1",
  shortName: "BD",
  title: "ボード",
  role: "owner",
  createdAt: "2026-01-01T00:00:00Z",
  ...over,
});

const positionDto = (over: Partial<PositionDto> = {}): PositionDto => ({
  id: "pos-1",
  boardId: "board-1",
  name: "未着手",
  orderIndex: 0,
  createdAt: "2026-01-01T00:00:00Z",
  ...over,
});

const taskDto = (over: Partial<TaskDto> = {}): TaskDto => ({
  id: "task-1",
  boardId: "board-1",
  positionId: "pos-1",
  categoryId: "cat-1",
  assigneeId: "assignee-1",
  name: "タスク名",
  comment: "コメント",
  importance: 2,
  deadline: "2026-07-08",
  // サーバーは order_index を返す（UI 側では使わないが、DTO の形としては持つ）
  orderIndex: 1.5,
  createdAt: "2026-01-01T00:00:00Z",
  ...over,
});

/** 一覧（GET /boards）が返す、中身を含んだ board。 */
const boardDetailDto = (over: Partial<BoardDto> = {}, contents: Partial<{
  positions: PositionDto[];
  tasks: TaskDto[];
  categories: { id: string; boardId: string; name: string; color: string; createdAt: string }[];
  members: { userId: string; name: string; email: string; role: "owner" | "member" }[];
}> = {}) => ({
  ...boardDto(over),
  positions: contents.positions ?? [],
  tasks: contents.tasks ?? [],
  categories: contents.categories ?? [],
  members: contents.members ?? [],
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadBoards", () => {
  it("1 リクエストで受け取った中身をネスト構造へ組み立てる", async () => {
    mocks.getMineBoards.mockResolvedValue([
      boardDetailDto({}, { positions: [positionDto()], tasks: [taskDto()] }),
    ]);

    const [board] = await loadBoards();

    expect(board).toMatchObject({
      id: "board-1",
      shortName: "BD",
      title: "ボード",
    });
    expect(board.positions).toEqual([{ id: "pos-1", name: "未着手" }]);
    expect(board.tasks).toHaveLength(1);
  });

  // board が何枚でもリクエストは 1 本。増えると起動が遅くなり、画面へ戻るたびの
  // 再取得だけでレート制限（100 回/分）を使い切ってしまう。
  it("board が何枚あってもリクエストは 1 本だけ", async () => {
    mocks.getMineBoards.mockResolvedValue([
      boardDetailDto({ id: "board-1" }),
      boardDetailDto({ id: "board-2" }),
      boardDetailDto({ id: "board-3" }),
    ]);

    const boards = await loadBoards();

    expect(boards.map((b) => b.id)).toEqual(["board-1", "board-2", "board-3"]);
    expect(mocks.getMineBoards).toHaveBeenCalledTimes(1);
    expect(mocks.getPositionsByBoard).not.toHaveBeenCalled();
    expect(mocks.getTasksByBoard).not.toHaveBeenCalled();
    expect(mocks.getCategoriesByBoard).not.toHaveBeenCalled();
    expect(mocks.getMembers).not.toHaveBeenCalled();
  });

  it("board が無ければ空配列を返す", async () => {
    mocks.getMineBoards.mockResolvedValue([]);

    await expect(loadBoards()).resolves.toEqual([]);
  });

  it("Position は id と name だけに絞る（orderIndex などは落とす）", async () => {
    mocks.getMineBoards.mockResolvedValue([
      boardDetailDto({}, { positions: [positionDto()] }),
    ]);

    const [board] = await loadBoards();

    expect(board.positions[0]).toEqual({ id: "pos-1", name: "未着手" });
  });

  it("Task の null フィールドを UI の既定値へ埋める", async () => {
    mocks.getMineBoards.mockResolvedValue([
      boardDetailDto({}, {
        tasks: [
          taskDto({
            comment: null,
            importance: null,
            deadline: null,
            categoryId: null,
            positionId: null,
          }),
        ],
      }),
    ]);

    const [board] = await loadBoards();
    const [task] = tasksOf(board);

    expect(task).toMatchObject({
      comment: "",
      importance: 0,
      categoryId: "",
      positionId: "",
    });
    expect(task.deadline).toBeUndefined();
  });

  it("deadline をローカルタイムの Date として解釈する（日ズレしない）", async () => {
    mocks.getMineBoards.mockResolvedValue([
      boardDetailDto({}, { tasks: [taskDto({ deadline: "2026-07-08" })] }),
    ]);

    const [board] = await loadBoards();
    const deadline = tasksOf(board)[0].deadline!;

    expect(deadline.getFullYear()).toBe(2026);
    expect(deadline.getMonth()).toBe(6); // 0 始まり
    expect(deadline.getDate()).toBe(8);
  });

  it("取得に失敗したら reject する", async () => {
    mocks.getMineBoards.mockRejectedValue(new Error("boards failed"));

    await expect(loadBoards()).rejects.toThrow("boards failed");
  });
});

describe("loadBoards（カテゴリー）", () => {
  it("カテゴリーは id / name / color に絞って載せる", async () => {
    mocks.getMineBoards.mockResolvedValue([
      boardDetailDto({ id: "board-1" }, {
        categories: [
          {
            id: "cat-1",
            boardId: "board-1",
            name: "仕事",
            color: "#ff0000",
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    ]);

    const [board] = await loadBoards();

    expect(board.categories).toEqual([
      { id: "cat-1", name: "仕事", color: "#ff0000" },
    ]);
  });

  it("role を BoardInfo に引き継ぐ", async () => {
    mocks.getMineBoards.mockResolvedValue([boardDetailDto({ role: "member" })]);

    const [board] = await loadBoards();

    expect(board.role).toBe("member");
  });
});

describe("loadUser", () => {
  it("DTO を name / email に絞って返す", async () => {
    mocks.getMe.mockResolvedValue({
      id: "user-1",
      name: "テスト太郎",
      email: "taro@example.com",
      createdAt: "2026-01-01T00:00:00Z",
    });

    await expect(loadUser()).resolves.toEqual({
      name: "テスト太郎",
      email: "taro@example.com",
    });
  });

  it("取得に失敗したら reject する", async () => {
    mocks.getMe.mockRejectedValue(new Error("unauthorized"));

    await expect(loadUser()).rejects.toThrow("unauthorized");
  });
});

describe("toUpdateTaskRequest", () => {
  it("各フィールドをそのまま写す", () => {
    const req = toUpdateTaskRequest(baseTask);
    expect(req).toMatchObject({
      positionId: "pos-1",
      categoryId: "cat-1",
      name: "タスク名",
      comment: "コメント",
      importance: 2,
    });
  });

  // 並べ替えは move の担当。編集のペイロードに order_index は載せない
  // （クライアントの値は古いことがあり、書き戻すと並びを壊す）。
  it("orderIndex は載せない", () => {
    expect(toUpdateTaskRequest(baseTask)).not.toHaveProperty("orderIndex");
  });

  it("deadline をローカルタイムの YYYY-MM-DD へ整形する（日ズレしない）", () => {
    expect(toUpdateTaskRequest(baseTask).deadline).toBe("2026-07-08");
  });

  it("月日を 0 埋めする", () => {
    const task = { ...baseTask, deadline: new Date(2026, 0, 3) };
    expect(toUpdateTaskRequest(task).deadline).toBe("2026-01-03");
  });

  it("deadline 未設定は null", () => {
    const task = { ...baseTask, deadline: undefined };
    expect(toUpdateTaskRequest(task).deadline).toBeNull();
  });

  it("空文字の positionId / categoryId は null に戻す", () => {
    const task = { ...baseTask, positionId: "", categoryId: "" };
    const req = toUpdateTaskRequest(task);
    expect(req.positionId).toBeNull();
    expect(req.categoryId).toBeNull();
  });
});

describe("toCreateTaskRequest", () => {
  it("id と boardId を含める", () => {
    const req = toCreateTaskRequest(baseTask, "board-9");
    expect(req.id).toBe("task-1");
    expect(req.boardId).toBe("board-9");
  });

  it("update と同じ整形ルールで deadline / 空 id を扱う", () => {
    const task = { ...baseTask, categoryId: "", deadline: undefined };
    const req = toCreateTaskRequest(task, "board-9");
    expect(req.categoryId).toBeNull();
    expect(req.deadline).toBeNull();
  });
});

describe("DTO → UI → DTO の往復", () => {
  it("読み込んだタスクを更新ペイロードへ戻すと元の値に一致する", async () => {
    mocks.getMineBoards.mockResolvedValue([
      boardDetailDto({}, { tasks: [taskDto()] }),
    ]);

    const [board] = await loadBoards();
    const req = toUpdateTaskRequest(tasksOf(board)[0]);

    expect(req).toEqual({
      positionId: "pos-1",
      categoryId: "cat-1",
      assigneeId: "assignee-1",
      name: "タスク名",
      comment: "コメント",
      importance: 2,
      deadline: "2026-07-08",
    });
  });
});
