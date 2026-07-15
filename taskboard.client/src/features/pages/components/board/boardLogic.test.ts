import { describe, it, expect } from "vitest";
import {
  COLUMN_PREFIX,
  resolveDrop,
  buildColumns,
  flattenColumns,
  buildNextTasks,
} from "./boardLogic";
import type { TaskInfo } from "../../../../types/taskInfo";

const t = (id: string, positionId: string): TaskInfo => ({
  id,
  name: id,
  comment: "",
  importance: 0,
  categoryId: "",
  positionId,
  assigneeId: "",
  orderIndex: 0,
});

const ids = (tasks: TaskInfo[] | null) => tasks?.map((x) => x.id);
const posIds = ["p1", "p2"];

describe("resolveDrop", () => {
  const tasks = [t("a", "p1"), t("b", "p2")];

  it("over が無ければ null", () => {
    expect(resolveDrop(null, null, null, tasks)).toBeNull();
  });

  it("コンテナ上なら末尾追加（overTaskId=null）", () => {
    expect(
      resolveDrop(`${COLUMN_PREFIX}p2`, null, null, tasks),
    ).toEqual({ destPosId: "p2", overTaskId: null, placeAfter: false });
  });

  it("存在しないタスク上なら null", () => {
    expect(resolveDrop("zzz", null, null, tasks)).toBeNull();
  });

  it("対象タスクの下半分に重なると後ろに挿入（placeAfter=true）", () => {
    const drop = resolveDrop(
      "b",
      { top: 100, height: 20 }, // 中心 110
      { top: 200, height: 20 }, // 中心 210 > 110
      tasks,
    );
    expect(drop).toEqual({
      destPosId: "p2",
      overTaskId: "b",
      placeAfter: true,
    });
  });

  it("上半分なら前に挿入（placeAfter=false）", () => {
    const drop = resolveDrop(
      "b",
      { top: 100, height: 20 }, // 中心 110
      { top: 0, height: 20 }, // 中心 10 < 110
      tasks,
    );
    expect(drop?.placeAfter).toBe(false);
  });

  it("activeRect が無ければ placeAfter=false", () => {
    const drop = resolveDrop("b", { top: 100, height: 20 }, null, tasks);
    expect(drop?.placeAfter).toBe(false);
  });

  // コンテナが複数列のグリッドに折り返る場合、同じ行内のカードは top がほぼ同じになる。
  // left/width がある時はそちらで前後を判定する（無ければ縦方向のみで判定する既存の挙動を維持）。
  describe("複数列グリッド（同じ行内の左右判定）", () => {
    it("同じ行で対象より右にあれば後ろに挿入（placeAfter=true）", () => {
      const drop = resolveDrop(
        "b",
        { top: 100, height: 20, left: 0, width: 140 }, // 中心x=70
        { top: 100, height: 20, left: 200, width: 140 }, // 中心x=270 > 70
        tasks,
      );
      expect(drop?.placeAfter).toBe(true);
    });

    it("同じ行で対象より左にあれば前に挿入（placeAfter=false）", () => {
      const drop = resolveDrop(
        "b",
        { top: 100, height: 20, left: 200, width: 140 }, // 中心x=270
        { top: 100, height: 20, left: 0, width: 140 }, // 中心x=70 < 270
        tasks,
      );
      expect(drop?.placeAfter).toBe(false);
    });

    it("行が違えば left/width があっても縦方向で判定する", () => {
      // active は over より下の行(top大)にあるが、横位置は over よりずっと左
      const drop = resolveDrop(
        "b",
        { top: 100, height: 20, left: 400, width: 140 }, // 中心y=110
        { top: 300, height: 20, left: 0, width: 140 }, // 中心y=310 > 110 → 後ろ
        tasks,
      );
      expect(drop?.placeAfter).toBe(true);
    });

    it("片方にしか left/width が無ければ縦方向のみで判定する（クラッシュしない）", () => {
      const drop = resolveDrop(
        "b",
        { top: 100, height: 20, left: 0, width: 140 }, // 中心y=110
        { top: 0, height: 20 }, // 中心y=10 < 110 → 前
        tasks,
      );
      expect(drop?.placeAfter).toBe(false);
    });
  });
});

describe("buildColumns / flattenColumns", () => {
  it("position 順にグループ化し、平坦化で往復できる", () => {
    const tasks = [t("c", "p2"), t("a", "p1"), t("b", "p1")];
    const cols = buildColumns(tasks, posIds);
    expect(ids(cols.get("p1")!)).toEqual(["a", "b"]);
    expect(ids(cols.get("p2")!)).toEqual(["c"]);
    // flatten は position 順（p1 → p2）
    expect(ids(flattenColumns(cols, posIds))).toEqual(["a", "b", "c"]);
  });
});

describe("buildNextTasks", () => {
  // 初期配置: p1=[a,b], p2=[c]
  const base = [t("a", "p1"), t("b", "p1"), t("c", "p2")];

  it("別コンテナの末尾へ移動し positionId を更新する", () => {
    const next = buildNextTasks(base, posIds, "a", "p2", null, false);
    expect(ids(next)).toEqual(["b", "c", "a"]);
    expect(next?.find((x) => x.id === "a")?.positionId).toBe("p2");
  });

  it("同一コンテナ内で対象の後ろへ入れる（placeAfter=true）", () => {
    // a を b の後ろへ → [b, a]
    const next = buildNextTasks(base, posIds, "a", "p1", "b", true);
    expect(ids(next)).toEqual(["b", "a", "c"]);
  });

  it("空コンテナ(コンテナ自体)へ移動できる（overTaskId=null）", () => {
    // c を p1 の末尾へ
    const next = buildNextTasks(base, posIds, "c", "p1", null, false);
    expect(ids(next)).toEqual(["a", "b", "c"]);
    expect(next?.find((x) => x.id === "c")?.positionId).toBe("p1");
  });

  it("自分自身の上にドロップすると変化なし → null", () => {
    expect(buildNextTasks(base, posIds, "a", "p1", "a", false)).toBeNull();
  });

  it("元の位置と同じ結果になる移動は null（ちらつき防止）", () => {
    // a を b の前(=現在位置)へ → [a, b] のまま
    expect(buildNextTasks(base, posIds, "a", "p1", "b", false)).toBeNull();
  });

  it("存在しない activeId は null", () => {
    expect(buildNextTasks(base, posIds, "zzz", "p1", null, false)).toBeNull();
  });
});
