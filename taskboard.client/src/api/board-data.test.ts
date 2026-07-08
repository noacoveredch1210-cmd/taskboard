import { describe, it, expect } from "vitest";
import { toCreateTaskRequest, toUpdateTaskRequest } from "./board-data";
import type { TaskInfo } from "../types/taskInfo";

const baseTask: TaskInfo = {
  id: "task-1",
  name: "タスク名",
  comment: "コメント",
  importance: 2,
  deadline: new Date(2026, 6, 8), // ローカル 2026-07-08
  categoryId: "cat-1",
  positionId: "pos-1",
  orderIndex: 1.5,
};

describe("toUpdateTaskRequest", () => {
  it("各フィールドをそのまま写す", () => {
    const req = toUpdateTaskRequest(baseTask);
    expect(req).toMatchObject({
      positionId: "pos-1",
      categoryId: "cat-1",
      name: "タスク名",
      comment: "コメント",
      importance: 2,
      orderIndex: 1.5,
    });
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
