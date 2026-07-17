import { describe, it, expect } from "vitest";
import type { ClientRect } from "@dnd-kit/core";
import { collisionDetection } from "./dndCollision";
import { COLUMN_PREFIX } from "./boardLogic";

const rect = (left: number, top: number, w: number, h: number): ClientRect => ({
  top,
  left,
  right: left + w,
  bottom: top + h,
  width: w,
  height: h,
});

/**
 * dnd-kit が衝突判定に渡す引数を最小限で組み立てる。
 * pointerWithin / rectIntersection は droppableContainers を回して
 * droppableRects から矩形を引く。
 */
const buildArgs = (
  rects: Record<string, ClientRect>,
  pointer: { x: number; y: number } | null,
  collisionRect: ClientRect,
) => {
  const droppableRects = new Map(Object.entries(rects));
  const droppableContainers = Object.keys(rects).map((id) => ({
    id,
    rect: { current: rects[id] },
    // 実際には他のプロパティもあるが、この 2 つしか参照されない。
  }));
  return {
    active: { id: "active", data: { current: undefined }, rect: { current: {} } },
    collisionRect,
    droppableRects,
    droppableContainers,
    pointerCoordinates: pointer,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
};

// カラム(縦長)の中にカードが 1 枚ある配置。
const COL = `${COLUMN_PREFIX}p1`;
const rects = {
  [COL]: rect(0, 0, 240, 600), // カラム全体
  b: rect(20, 20, 200, 140), // カラム上部のカード
};

describe("collisionDetection", () => {
  it("カードの上ではカードを返す（コンテナより優先する）", () => {
    // カード b の中心。カラムとカードの両方に当たる。
    const args = buildArgs(rects, { x: 120, y: 90 }, rect(20, 20, 200, 140));
    const result = collisionDetection(args);
    expect(result.map((c) => c.id)).toEqual(["b"]);
  });

  it("カードの無い余白ではコンテナを返す（末尾へ追加させる）", () => {
    // カラム内だがカードより下の余白。
    const args = buildArgs(rects, { x: 120, y: 400 }, rect(20, 330, 200, 140));
    const result = collisionDetection(args);
    expect(result.map((c) => c.id)).toEqual([COL]);
  });

  it("ポインタがどこにも入っていなければ矩形の重なりで拾う", () => {
    // ポインタはカラムの外。ただしドラッグ中の矩形はカラムに重なっている。
    const args = buildArgs(rects, { x: 900, y: 400 }, rect(100, 300, 200, 140));
    const result = collisionDetection(args);
    expect(result.length).toBeGreaterThan(0);
    expect(result.map((c) => c.id)).toContain(COL);
  });

  it("空のカラム（カードが無い）ではコンテナを返す", () => {
    const emptyCol = `${COLUMN_PREFIX}p2`;
    const args = buildArgs(
      { [emptyCol]: rect(0, 0, 240, 600) },
      { x: 120, y: 300 },
      rect(20, 230, 200, 140),
    );
    const result = collisionDetection(args);
    expect(result.map((c) => c.id)).toEqual([emptyCol]);
  });
});
