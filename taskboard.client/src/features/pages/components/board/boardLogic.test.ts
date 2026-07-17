import { describe, it, expect } from "vitest";
import {
  COLUMN_PREFIX,
  resolveDrop,
  buildColumns,
  flattenColumns,
  buildNextTasks,
  buildDragOverTasks,
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

  // 掴んだカードは対象カードの真上に重なって動くため、矩形の重なりでは
  // 「隣に並んでいる」のか「重なっているだけ」なのか区別できない。
  // 前後は縦方向の中心だけで決める（1 列でもグリッドでも同じ規則）。
  describe("重なっているカードの前後判定", () => {
    it("1 列で対象カードの下半分に重ねたら後ろに挿入（placeAfter=true）", () => {
      const drop = resolveDrop(
        "b",
        { top: 200, height: 100 }, // over: 中心y=250
        { top: 250, height: 100 }, // active: 中心y=300 > 250
        tasks,
      );
      expect(drop?.placeAfter).toBe(true);
    });

    it("1 列で対象カードの上半分に重ねたら前に挿入（placeAfter=false）", () => {
      const drop = resolveDrop(
        "b",
        { top: 200, height: 100 }, // over: 中心y=250
        { top: 150, height: 100 }, // active: 中心y=200 < 250
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

  it("別コンテナの先頭へ移動し positionId を更新する", () => {
    const next = buildNextTasks(base, posIds, "a", "p2", null, false);
    expect(ids(next)).toEqual(["b", "a", "c"]);
    expect(next?.find((x) => x.id === "a")?.positionId).toBe("p2");
  });

  // 同じカラム内は座標（placeAfter）を見ず、移動方向で決める。
  it("同じカラムで下へ動かすと、対象カードの場所を奪う", () => {
    // a を b へ重ねる（下へ移動）→ [b, a]
    const next = buildNextTasks(base, posIds, "a", "p1", "b", false);
    expect(ids(next)).toEqual(["b", "a", "c"]);
  });

  it("同じカラムで上へ動かすと、対象カードの場所を奪う", () => {
    // b を a へ重ねる（上へ移動）→ [b, a]
    const next = buildNextTasks(base, posIds, "b", "p1", "a", false);
    expect(ids(next)).toEqual(["b", "a", "c"]);
  });

  // 横に並んだカードへ左右から重ねると縦の中心がほぼ一致し、placeAfter は
  // 数 px のぶれで反転する。同じカラム内ではそれに影響されてはいけない。
  it("同じカラム内では placeAfter がどちらでも結果が変わらない", () => {
    expect(ids(buildNextTasks(base, posIds, "b", "p1", "a", true))).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(ids(buildNextTasks(base, posIds, "b", "p1", "a", false))).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("別カラムへ移すときは placeAfter で前後が決まる", () => {
    // c(p2) を p1 の b の後ろ / 前へ
    expect(ids(buildNextTasks(base, posIds, "c", "p1", "b", true))).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(ids(buildNextTasks(base, posIds, "c", "p1", "b", false))).toEqual([
      "a",
      "c",
      "b",
    ]);
  });

  it("コンテナの余白へ落とすと先頭に入る（overTaskId=null）", () => {
    // c を p1 の先頭へ
    const next = buildNextTasks(base, posIds, "c", "p1", null, false);
    expect(ids(next)).toEqual(["c", "a", "b"]);
    expect(next?.find((x) => x.id === "c")?.positionId).toBe("p1");
  });

  it("自分自身の上にドロップすると変化なし → null", () => {
    expect(buildNextTasks(base, posIds, "a", "p1", "a", false)).toBeNull();
  });

  it("元の位置と同じ結果になる移動は null（ちらつき防止）", () => {
    // p2 に 1 枚だけの c を、その p2 の余白へ運んでも並びは変わらない
    expect(buildNextTasks(base, posIds, "c", "p2", null, false)).toBeNull();
  });

  it("存在しない activeId は null", () => {
    expect(buildNextTasks(base, posIds, "zzz", "p1", null, false)).toBeNull();
  });
});

// dragOver は「更新 → 再計測 → 再判定」で同じカーソル位置のまま何度も走る。
// 同じ入力を与えたら 2 回目は必ず「変化なし」にならないと、更新が止まらず
// React が Maximum update depth exceeded で落ちる（画面が真っ白になる）。
describe("buildDragOverTasks（ドラッグ中の反映は繰り返しても収束する）", () => {
  const oneCol = [t("a", "p1"), t("b", "p1"), t("c", "p1")];

  it("同じカラム内では動かさない（確定は dragEnd）", () => {
    expect(buildDragOverTasks(oneCol, posIds, "c", "p1", "a", false)).toBeNull();
  });

  it("別カラムへ移したあと、同じ判定を繰り返しても変化しない", () => {
    const base2 = [t("a", "p1"), t("b", "p1"), t("c", "p2")];
    // c を p1 の a の上へ（別カラム → 反映する）
    const first = buildDragOverTasks(base2, posIds, "c", "p1", "a", false);
    expect(ids(first)).toEqual(["c", "a", "b"]);
    // 同じカーソル位置のまま 2 回目。ここで動くと振動する。
    expect(buildDragOverTasks(first!, posIds, "c", "p1", "a", false)).toBeNull();
  });

  it("空カラムへ移したあと、同じ判定を繰り返しても変化しない", () => {
    const base2 = [t("a", "p1"), t("b", "p1")];
    const first = buildDragOverTasks(base2, posIds, "b", "p2", null, false);
    expect(ids(first)).toEqual(["a", "b"]);
    expect(first?.find((x) => x.id === "b")?.positionId).toBe("p2");
    expect(buildDragOverTasks(first!, posIds, "b", "p2", null, false)).toBeNull();
  });
});
