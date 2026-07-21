import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// useBoards は API モジュールを直接呼ぶため、それぞれを差し替える。
const mocks = vi.hoisted(() => ({
  loadBoards: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  moveTask: vi.fn(),
  removeTask: vi.fn(),
  createBoard: vi.fn(),
  updateBoard: vi.fn(),
  removeBoard: vi.fn(),
  createPosition: vi.fn(),
  updatePosition: vi.fn(),
  removePosition: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  removeCategory: vi.fn(),
  joinBoard: vi.fn(),
  leaveBoard: vi.fn(),
  getShareToken: vi.fn(),
  reportError: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("../api/board-data", async (importOriginal) => {
  // toCreateTaskRequest / toUpdateTaskRequest は純粋な変換なので実物を使う。
  const actual =
    await importOriginal<typeof import("../api/board-data")>();
  return { ...actual, loadBoards: mocks.loadBoards };
});
vi.mock("../api/tasks", () => ({
  tasksApi: {
    create: mocks.createTask,
    update: mocks.updateTask,
    move: mocks.moveTask,
    remove: mocks.removeTask,
  },
}));
vi.mock("../api/boards", () => ({
  boardsApi: {
    create: mocks.createBoard,
    update: mocks.updateBoard,
    remove: mocks.removeBoard,
    join: mocks.joinBoard,
    leave: mocks.leaveBoard,
    getShareToken: mocks.getShareToken,
  },
}));
vi.mock("../api/categories", () => ({
  categoriesApi: {
    create: mocks.createCategory,
    update: mocks.updateCategory,
    remove: mocks.removeCategory,
  },
}));
vi.mock("../api/positions", () => ({
  positionsApi: {
    create: mocks.createPosition,
    update: mocks.updatePosition,
    remove: mocks.removePosition,
  },
}));
vi.mock("./reportError", () => ({
  reportError: (message: string) => (err: unknown) =>
    mocks.reportError(message, err),
}));
vi.mock("../components/toast/ToastContext", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

import { useBoards } from "./useBoards";
import type { BoardInfo } from "../types/boardInfo";
import type { TaskInfo } from "../types/taskInfo";

const task = (overrides: Partial<TaskInfo> & { id: string }): TaskInfo => ({
  name: "タスク",
  comment: "",
  importance: 0,
  categoryId: "",
  positionId: "pos-1",
  assigneeId: "",
  ...overrides,
});

const board = (overrides: Partial<BoardInfo> = {}): BoardInfo => ({
  id: "board-1",
  shortName: "B1",
  title: "ボード1",
  role: "owner",
  positions: [
    { id: "pos-1", name: "未着手" },
    { id: "pos-2", name: "完了" },
  ],
  categories: [],
  tasks: [],
  ...overrides,
});

/** 初回ロードを済ませた状態のフックを返す。 */
const renderLoaded = async (boards: BoardInfo[] = [board()]) => {
  mocks.loadBoards.mockResolvedValue(boards);
  const view = renderHook(() => useBoards());
  await waitFor(() => expect(view.result.current.loaded).toBe(true));
  return view;
};

beforeEach(() => {
  vi.clearAllMocks();
  // 各 API は既定で成功させる（失敗時の挙動は個別のテストで上書きする）。
  mocks.createTask.mockResolvedValue(undefined);
  mocks.updateTask.mockResolvedValue(undefined);
  mocks.moveTask.mockResolvedValue(undefined);
  mocks.removeTask.mockResolvedValue(undefined);
  mocks.createBoard.mockResolvedValue(undefined);
  mocks.updateBoard.mockResolvedValue(undefined);
  mocks.removeBoard.mockResolvedValue(undefined);
  mocks.createPosition.mockResolvedValue(undefined);
  mocks.updatePosition.mockResolvedValue(undefined);
  mocks.removePosition.mockResolvedValue(undefined);
  mocks.createCategory.mockResolvedValue(undefined);
  mocks.updateCategory.mockResolvedValue(undefined);
  mocks.removeCategory.mockResolvedValue(undefined);
});

describe("初回ロード", () => {
  it("取得した board を state に載せ、loaded を立てる", async () => {
    const { result } = await renderLoaded([board()]);

    expect(result.current.boards).toHaveLength(1);
    expect(result.current.error).toBe(false);
  });

  it("取得に失敗したら error を立て、loaded も立てる", async () => {
    const failure = new Error("network");
    mocks.loadBoards.mockRejectedValue(failure);

    const { result } = renderHook(() => useBoards());

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.error).toBe(true);
    expect(result.current.boards).toEqual([]);
    expect(mocks.reportError).toHaveBeenCalledWith(
      "boardの取得に失敗しました",
      failure,
    );
  });
});

describe("saveTask", () => {
  // order_index の採番はサーバーの担当（新規はそのカラムの先頭へ入る）。
  it("新規タスクの作成では orderIndex を送らない", async () => {
    const { result } = await renderLoaded([
      board({
        tasks: [
          task({ id: "t1", positionId: "pos-1" }),
          task({ id: "t2", positionId: "pos-1" }),
        ],
      }),
    ]);

    act(() => {
      result.current.saveTask("board-1", task({ id: "new", name: "新規" }));
    });

    expect(mocks.createTask).toHaveBeenCalledTimes(1);
    expect(mocks.createTask.mock.calls[0][0]).toMatchObject({
      id: "new",
      boardId: "board-1",
    });
    expect(mocks.createTask.mock.calls[0][0]).not.toHaveProperty("orderIndex");
  });

  it("新規タスクは表示順でも先頭に来る（配列の先頭へ入れる）", async () => {
    const { result } = await renderLoaded([
      board({
        tasks: [
          task({ id: "t1", positionId: "pos-1" }),
          task({ id: "t2", positionId: "pos-1" }),
        ],
      }),
    ]);

    act(() => {
      result.current.saveTask("board-1", task({ id: "new", name: "新規" }));
    });

    // 表示順は配列順なので、同じ列の並びで先頭に居ること
    const inColumn = result.current.boards[0].tasks
      ?.filter((t) => t.positionId === "pos-1")
      .map((t) => t.id);
    expect(inColumn).toEqual(["new", "t1", "t2"]);
  });

  it("空の列にも追加できる", async () => {
    const { result } = await renderLoaded([board({ tasks: [] })]);

    act(() => {
      result.current.saveTask("board-1", task({ id: "new" }));
    });

    expect(mocks.createTask).toHaveBeenCalledTimes(1);
    expect(result.current.boards[0].tasks).toHaveLength(1);
  });

  it("既存タスクは更新し、作成しない", async () => {
    const existing = task({ id: "t1", name: "旧" });
    const { result } = await renderLoaded([board({ tasks: [existing] })]);

    act(() => {
      result.current.saveTask("board-1", { ...existing, name: "新" });
    });

    expect(mocks.createTask).not.toHaveBeenCalled();
    expect(mocks.updateTask).toHaveBeenCalledTimes(1);
    expect(mocks.updateTask.mock.calls[0][0]).toBe("t1");
    expect(mocks.updateTask.mock.calls[0][1]).toMatchObject({ name: "新" });
    expect(result.current.boards[0].tasks?.[0].name).toBe("新");
  });

  it("作成に失敗したら通知し、サーバーの状態へ巻き戻す", async () => {
    const failure = new Error("boom");
    mocks.createTask.mockRejectedValue(failure);
    // サーバーにはタスクが無い状態を返させる。
    const { result } = await renderLoaded([board({ tasks: [] })]);

    await act(async () => {
      result.current.saveTask("board-1", task({ id: "new" }));
    });

    // 楽観的に追加したタスクは、再取得によって消える。
    expect(result.current.boards[0].tasks).toEqual([]);
    expect(mocks.showToast).toHaveBeenCalledWith("タスクの作成に失敗しました");
    expect(mocks.reportError).toHaveBeenCalledWith(
      "タスクの作成に失敗しました",
      failure,
    );
  });

});

describe("通信が切れていて再取得もできない場合", () => {
  it("作成を、操作前の状態へ巻き戻す", async () => {
    mocks.createTask.mockRejectedValue(new Error("boom"));
    const { result } = await renderLoaded([
      board({ tasks: [task({ id: "existing" })] }),
    ]);

    // 巻き戻しのための再取得も失敗させる（通信断）。
    const refetchFailure = new Error("offline");
    mocks.loadBoards.mockRejectedValue(refetchFailure);

    await act(async () => {
      result.current.saveTask("board-1", task({ id: "new" }));
    });

    // 再取得できなくても、操作前のタスクだけが残る。
    expect(result.current.boards[0].tasks?.map((t) => t.id)).toEqual([
      "existing",
    ]);
    expect(mocks.showToast).toHaveBeenCalledWith("タスクの作成に失敗しました");
    expect(mocks.reportError).toHaveBeenCalledWith(
      "最新の状態を取得できませんでした",
      refetchFailure,
    );
  });

  it("board の削除を、操作前の状態へ巻き戻す", async () => {
    mocks.removeBoard.mockRejectedValue(new Error("boom"));
    const { result } = await renderLoaded([board({ id: "board-1" })]);
    mocks.loadBoards.mockRejectedValue(new Error("offline"));

    await act(async () => {
      result.current.deleteBoards(["board-1"]);
    });

    expect(result.current.boards.map((b) => b.id)).toEqual(["board-1"]);
  });

  it("タスクの移動を、ドラッグ開始時点の並びへ巻き戻す", async () => {
    mocks.moveTask.mockRejectedValue(new Error("boom"));
    const before = [
      task({ id: "a", positionId: "pos-1" }),
      task({ id: "moved", positionId: "pos-1" }),
    ];
    const { result } = await renderLoaded([board({ tasks: before })]);
    mocks.loadBoards.mockRejectedValue(new Error("offline"));

    // ドラッグ中のライブ反映（reorderTasks）で state は既に移動後になっている。
    const after = [
      task({ id: "moved", positionId: "pos-2" }),
      task({ id: "a", positionId: "pos-1" }),
    ];
    await act(async () => {
      result.current.reorderTasks("board-1", after);
    });
    await act(async () => {
      result.current.commitTaskMove("board-1", "moved", after, before);
    });

    // クロージャの boards ではなく、渡された「移動前の並び」へ戻る。
    const tasks = result.current.boards[0].tasks ?? [];
    expect(tasks.map((t) => t.id)).toEqual(["a", "moved"]);
    expect(tasks.find((t) => t.id === "moved")?.positionId).toBe("pos-1");
    expect(mocks.showToast).toHaveBeenCalledWith(
      "タスクの並び順の保存に失敗しました",
    );
  });
});

// order_index の採番はサーバーの担当。クライアントは「移動先の両隣は誰か」だけを送る。
// 中間値・枯渇・振り直しの検証はサーバーの統合テスト（実 DB）が持つ。
describe("commitTaskMove（サーバーへ送るのは値ではなく両隣）", () => {
  /** 指定の列を持つ board を用意し、移動後のタスク配列を渡して commit する。 */
  const commit = async (tasks: TaskInfo[], movedId: string) => {
    const { result } = await renderLoaded([board({ tasks })]);
    act(() => {
      // ここでは巻き戻しは起きないため、移動前後で同じ配列を渡してよい。
      result.current.commitTaskMove("board-1", movedId, tasks, tasks);
    });
    return result;
  };

  it("両隣に挟まれた位置なら prev と next を送る", async () => {
    await commit(
      [
        task({ id: "a", positionId: "pos-1" }),
        task({ id: "moved", positionId: "pos-1" }),
        task({ id: "b", positionId: "pos-1" }),
      ],
      "moved",
    );

    expect(mocks.moveTask).toHaveBeenCalledTimes(1);
    expect(mocks.moveTask.mock.calls[0][0]).toBe("moved");
    expect(mocks.moveTask.mock.calls[0][1]).toEqual({
      positionId: "pos-1",
      prevTaskId: "a",
      nextTaskId: "b",
    });
  });

  it("先頭なら prev は null", async () => {
    await commit(
      [
        task({ id: "moved", positionId: "pos-1" }),
        task({ id: "b", positionId: "pos-1" }),
      ],
      "moved",
    );

    expect(mocks.moveTask.mock.calls[0][1]).toMatchObject({
      prevTaskId: null,
      nextTaskId: "b",
    });
  });

  it("末尾なら next は null", async () => {
    await commit(
      [
        task({ id: "a", positionId: "pos-1" }),
        task({ id: "moved", positionId: "pos-1" }),
      ],
      "moved",
    );

    expect(mocks.moveTask.mock.calls[0][1]).toMatchObject({
      prevTaskId: "a",
      nextTaskId: null,
    });
  });

  it("列に 1 件だけなら両隣とも null", async () => {
    await commit([task({ id: "moved", positionId: "pos-1" })], "moved");

    expect(mocks.moveTask.mock.calls[0][1]).toMatchObject({
      prevTaskId: null,
      nextTaskId: null,
    });
  });

  it("存在しないタスク id なら何もしない", async () => {
    await commit([task({ id: "a" })], "unknown");

    expect(mocks.moveTask).not.toHaveBeenCalled();
  });

  it("別の列のタスクは両隣に含めない", async () => {
    // pos-1 は moved 1 件だけ。pos-2 のタスクを隣として送らないこと。
    await commit(
      [
        task({ id: "moved", positionId: "pos-1" }),
        task({ id: "x", positionId: "pos-2" }),
        task({ id: "y", positionId: "pos-2" }),
      ],
      "moved",
    );

    expect(mocks.moveTask.mock.calls[0][1]).toEqual({
      positionId: "pos-1",
      prevTaskId: null,
      nextTaskId: null,
    });
  });
});

describe("カテゴリー（ボード単位）", () => {
  it("createCategory は該当ボードに追加し、boardId 付きで API を呼ぶ", async () => {
    const { result } = await renderLoaded([board({ categories: [] })]);

    act(() => {
      result.current.createCategory("board-1", "仕事", "#ff0000");
    });

    const created = result.current.boards[0].categories;
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ name: "仕事", color: "#ff0000" });
    expect(mocks.createCategory).toHaveBeenCalledWith({
      id: created[0].id,
      boardId: "board-1",
      name: "仕事",
      color: "#ff0000",
    });
  });

  it("setCategory は既存値へマージして更新する", async () => {
    const { result } = await renderLoaded([
      board({ categories: [{ id: "c1", name: "仕事", color: "#ff0000" }] }),
    ]);

    act(() => {
      result.current.setCategory("board-1", "c1", { name: "私用" });
    });

    expect(result.current.boards[0].categories[0]).toEqual({
      id: "c1",
      name: "私用",
      color: "#ff0000", // 未指定は保たれる
    });
    expect(mocks.updateCategory).toHaveBeenCalledWith("c1", {
      name: "私用",
      color: "#ff0000",
    });
  });

  it("deleteCategories は指定した id だけ消す", async () => {
    const { result } = await renderLoaded([
      board({
        categories: [
          { id: "c1", name: "A", color: "#111111" },
          { id: "c2", name: "B", color: "#222222" },
        ],
      }),
    ]);

    act(() => {
      result.current.deleteCategories("board-1", ["c1"]);
    });

    expect(result.current.boards[0].categories.map((c) => c.id)).toEqual(["c2"]);
    expect(mocks.removeCategory).toHaveBeenCalledWith("c1");
  });

  it("カテゴリー作成が失敗したら通知し、サーバーの状態へ巻き戻す", async () => {
    mocks.createCategory.mockRejectedValue(new Error("boom"));
    const { result } = await renderLoaded([board({ categories: [] })]);

    await act(async () => {
      result.current.createCategory("board-1", "仕事", "#ff0000");
    });

    // 再取得（サーバーは空）で楽観的追加が消える。
    expect(result.current.boards[0].categories).toEqual([]);
    expect(mocks.showToast).toHaveBeenCalledWith("カテゴリーの作成に失敗しました");
  });
});

describe("共有", () => {
  it("参加リクエストが受理されたら requested を返し、承認待ちを通知する", async () => {
    const { result } = await renderLoaded([]);
    mocks.joinBoard.mockResolvedValue({ status: "requested" });

    let outcome: string | null = null;
    await act(async () => {
      outcome = await result.current.joinBoard("token-123");
    });

    expect(outcome).toBe("requested");
    expect(mocks.joinBoard).toHaveBeenCalledWith("token-123");
    expect(mocks.showToast).toHaveBeenCalledWith(
      "参加リクエストを送信しました。オーナーの承認をお待ちください。",
    );
    // まだメンバーではないので一覧は変わらない。
    expect(result.current.boards).toEqual([]);
  });

  it("既にメンバーなら member を返し、一覧を取り直す", async () => {
    const { result } = await renderLoaded([]);
    mocks.joinBoard.mockResolvedValue({
      status: "member",
      board: { id: "shared-1" },
    });
    mocks.loadBoards.mockResolvedValue([
      board({ id: "shared-1", role: "member" }),
    ]);

    let outcome: string | null = null;
    await act(async () => {
      outcome = await result.current.joinBoard("token-123");
    });

    expect(outcome).toBe("member");
    expect(result.current.boards.map((b) => b.id)).toEqual(["shared-1"]);
  });

  it("joinBoard は失敗したら通知して null を返す", async () => {
    const { result } = await renderLoaded([]);
    mocks.joinBoard.mockRejectedValue(new Error("invalid"));

    let joinedId: string | null = "x";
    await act(async () => {
      joinedId = await result.current.joinBoard("bad");
    });

    expect(joinedId).toBeNull();
    expect(mocks.showToast).toHaveBeenCalledWith(
      "ボードに参加できませんでした。リンクを確認してください。",
    );
  });

  it("getShareLink は join クエリ付きの URL を組み立てる", async () => {
    const { result } = await renderLoaded();
    mocks.getShareToken.mockResolvedValue("tok-abc");

    let link = "";
    await act(async () => {
      link = await result.current.getShareLink("board-1");
    });

    expect(mocks.getShareToken).toHaveBeenCalledWith("board-1");
    expect(link).toBe(`${window.location.origin}/?join=tok-abc`);
  });

  it("leaveBoard は成功したら一覧からそのボードを取り除く", async () => {
    mocks.leaveBoard.mockResolvedValue(undefined);
    const { result } = await renderLoaded([
      board({ id: "board-1" }),
      board({ id: "board-2" }),
    ]);

    let ok = false;
    await act(async () => {
      ok = await result.current.leaveBoard("board-1");
    });

    expect(ok).toBe(true);
    expect(mocks.leaveBoard).toHaveBeenCalledWith("board-1");
    expect(result.current.boards.map((b) => b.id)).toEqual(["board-2"]);
    expect(mocks.showToast).toHaveBeenCalledWith("ボードから退出しました。");
  });

  it("leaveBoard は失敗したら false を返し、一覧を変えない", async () => {
    mocks.leaveBoard.mockRejectedValue(new Error("boom"));
    const { result } = await renderLoaded([board({ id: "board-1" })]);

    let ok = true;
    await act(async () => {
      ok = await result.current.leaveBoard("board-1");
    });

    expect(ok).toBe(false);
    expect(result.current.boards.map((b) => b.id)).toEqual(["board-1"]);
    expect(mocks.showToast).toHaveBeenCalledWith(
      "ボードから退出できませんでした。",
    );
  });
});

describe("reorderTasks", () => {
  it("state だけを更新し、API は呼ばない（ドラッグ中のライブ反映）", async () => {
    const tasks = [task({ id: "a" })];
    const { result } = await renderLoaded([board({ tasks })]);

    const reordered = [task({ id: "a", name: "移動中" })];
    act(() => {
      result.current.reorderTasks("board-1", reordered);
    });

    expect(result.current.boards[0].tasks?.[0].name).toBe("移動中");
    expect(mocks.updateTask).not.toHaveBeenCalled();
  });
});

describe("createBoard", () => {
  // ボード本体・オーナー登録・最初の列は、サーバーが 1 トランザクションで作る。
  // 分けて投げると、ボードだけできて列が揃わない状態が残りうる。
  it("列も含めて 1 リクエストで作成する（配列順がそのまま表示順）", async () => {
    const { result } = await renderLoaded([]);
    const positions = [
      { id: "p1", name: "未着手" },
      { id: "p2", name: "完了" },
    ];

    await act(async () => {
      result.current.createBoard("新ボード", "NB", positions);
    });

    expect(mocks.createBoard).toHaveBeenCalledTimes(1);
    expect(mocks.createBoard.mock.calls[0][0]).toMatchObject({
      title: "新ボード",
      shortName: "NB",
      positions: [
        { id: "p1", name: "未着手" },
        { id: "p2", name: "完了" },
      ],
    });

    // 列へ個別のリクエストは投げない。
    expect(mocks.createPosition).not.toHaveBeenCalled();

    expect(result.current.boards).toHaveLength(1);
    expect(result.current.boards[0].title).toBe("新ボード");
  });

  it("作成に失敗したら通知し、列も作らない", async () => {
    const failure = new Error("boom");
    mocks.createBoard.mockRejectedValue(failure);
    const { result } = await renderLoaded([]);

    await act(async () => {
      result.current.createBoard("新ボード", "NB", [{ id: "p1", name: "列" }]);
    });

    expect(mocks.createPosition).not.toHaveBeenCalled();
    expect(mocks.reportError).toHaveBeenCalledWith(
      "boardの作成に失敗しました",
      failure,
    );
    expect(result.current.boards).toHaveLength(0); // 再取得で消える
  });
});

describe("setBoard", () => {
  // 列の追加・改名・並べ替え・削除と、消えた列のタスクの退避は、サーバーが
  // 1 トランザクションで行う。クライアントは「あるべき姿」を 1 回送るだけ。
  it("列の変更は 1 リクエストにまとめて送る（配列順がそのまま表示順）", async () => {
    const { result } = await renderLoaded();

    act(() => {
      result.current.setBoard("board-1", {
        positions: [
          { id: "pos-2", name: "完了" }, // 既存（順序が変わった）
          { id: "pos-3", name: "レビュー" }, // 新規
        ],
      });
    });

    expect(mocks.updateBoard).toHaveBeenCalledTimes(1);
    expect(mocks.updateBoard).toHaveBeenCalledWith("board-1", {
      shortName: "B1",
      title: "ボード1",
      positions: [
        { id: "pos-2", name: "完了" },
        { id: "pos-3", name: "レビュー" },
      ],
    });

    // 列やタスクへ個別のリクエストは投げない（中途半端な状態を作らないため）。
    expect(mocks.updatePosition).not.toHaveBeenCalled();
    expect(mocks.createPosition).not.toHaveBeenCalled();
    expect(mocks.removePosition).not.toHaveBeenCalled();
    expect(mocks.updateTask).not.toHaveBeenCalled();
  });

  it("消えた列のタスクは、再取得を待たずに先頭の列へ移して見せる", async () => {
    const { result } = await renderLoaded([
      board({
        tasks: [task({ id: "t1", positionId: "pos-2" })],
      }),
    ]);

    // pos-2 を削除する。
    act(() => {
      result.current.setBoard("board-1", {
        positions: [{ id: "pos-1", name: "未着手" }],
      });
    });

    // サーバーも同じ退避をするが、表示が一瞬でも欠けないよう state 側でも移す。
    expect(result.current.boards[0].tasks?.[0].positionId).toBe("pos-1");
  });

  it("positions を指定しなければ board のメタ情報だけを更新する", async () => {
    const { result } = await renderLoaded();

    act(() => {
      result.current.setBoard("board-1", { title: "改名" });
    });

    expect(mocks.updateBoard).toHaveBeenCalledWith("board-1", {
      title: "改名",
      shortName: "B1", // 未指定の項目は既存値が使われる
    });
    expect(mocks.updatePosition).not.toHaveBeenCalled();
    expect(mocks.createPosition).not.toHaveBeenCalled();
    expect(mocks.removePosition).not.toHaveBeenCalled();
    expect(result.current.boards[0].title).toBe("改名");
  });

  it("存在しない board id なら何もしない", async () => {
    const { result } = await renderLoaded();

    act(() => {
      result.current.setBoard("unknown", { title: "改名" });
    });

    expect(mocks.updateBoard).not.toHaveBeenCalled();
  });
});

describe("削除", () => {
  it("deleteBoards は指定した board を state と API の両方から消す", async () => {
    const { result } = await renderLoaded([
      board({ id: "board-1" }),
      board({ id: "board-2" }),
    ]);

    act(() => {
      result.current.deleteBoards(["board-1"]);
    });

    expect(result.current.boards.map((b) => b.id)).toEqual(["board-2"]);
    expect(mocks.removeBoard).toHaveBeenCalledTimes(1);
    expect(mocks.removeBoard).toHaveBeenCalledWith("board-1");
  });

  it("deleteTasks は指定したタスクだけを消す", async () => {
    const { result } = await renderLoaded([
      board({
        tasks: [task({ id: "t1" }), task({ id: "t2" }), task({ id: "t3" })],
      }),
    ]);

    act(() => {
      result.current.deleteTasks("board-1", ["t1", "t3"]);
    });

    expect(result.current.boards[0].tasks?.map((t) => t.id)).toEqual(["t2"]);
    expect(mocks.removeTask.mock.calls.map(([id]) => id)).toEqual(["t1", "t3"]);
  });

  it("削除に失敗したら通知し、消した board を再取得で復帰させる", async () => {
    const failure = new Error("boom");
    mocks.removeBoard.mockRejectedValue(failure);
    const { result } = await renderLoaded([board({ id: "board-1" })]);

    await act(async () => {
      result.current.deleteBoards(["board-1"]);
    });

    // 楽観的に消した board が、サーバーの状態から復活する。
    expect(result.current.boards.map((b) => b.id)).toEqual(["board-1"]);
    expect(mocks.showToast).toHaveBeenCalledWith("boardの削除に失敗しました");
    expect(mocks.reportError).toHaveBeenCalledWith(
      "boardの削除に失敗しました",
      failure,
    );
  });
});

// 共有ボードはリアルタイム同期をしていないので、開きっぱなしの画面は古くなる。
// 画面へ戻ってきたときに取り直して、その陳腐化を実用上の範囲に抑える。
describe("画面へ戻ってきたときの再取得", () => {
  // 時刻を進めて「間隔が空いた」ことにするので、テストごとに実時計へ戻す。
  afterEach(() => {
    vi.useRealTimers();
  });

  /** ウィンドウにフォーカスが戻ったことにする。 */
  const focus = async () => {
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
  };

  it("フォーカスが戻ったら board 一覧を取り直す", async () => {
    const { result } = await renderLoaded();
    expect(mocks.loadBoards).toHaveBeenCalledTimes(1); // 初回ロード分

    vi.setSystemTime(Date.now() + 60_000);
    mocks.loadBoards.mockResolvedValue([board({ title: "他の人が変えた" })]);
    await focus();

    expect(mocks.loadBoards).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(result.current.boards[0].title).toBe("他の人が変えた"),
    );
  });

  // loadBoards は board ごとに 4 本のリクエストを投げるので、往復のたびに取りに行くと
  // レート制限（100 回/分）に自分で当たる。
  it("短い間隔で戻ってきても取り直さない", async () => {
    await renderLoaded();
    expect(mocks.loadBoards).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 1_000);
    await focus();
    await focus();
    await focus();

    expect(mocks.loadBoards).toHaveBeenCalledTimes(1); // 増えない
  });

  it("画面が見えていなければ取り直さない", async () => {
    await renderLoaded();
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });

    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(mocks.loadBoards).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
  });

  // 利用者が頼んだ操作ではないので、失敗しても画面は壊さない（古いまま表示を続ける）。
  it("取り直しに失敗しても、表示は保ちエラー画面にしない", async () => {
    const { result } = await renderLoaded([board({ title: "元のまま" })]);

    vi.setSystemTime(Date.now() + 60_000);
    mocks.loadBoards.mockRejectedValue(new Error("offline"));
    await focus();

    await waitFor(() =>
      expect(mocks.reportError).toHaveBeenCalledWith(
        "最新の状態を取得できませんでした",
        expect.anything(),
      ),
    );
    expect(result.current.error).toBe(false);
    expect(result.current.boards[0].title).toBe("元のまま");
    expect(mocks.showToast).not.toHaveBeenCalled();
  });
});
