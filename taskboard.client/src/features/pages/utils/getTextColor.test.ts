import { describe, it, expect } from "vitest";
import { getTextColor } from "./getTextColor";

describe("getTextColor", () => {
  it("明るい背景色には黒文字を返す", () => {
    expect(getTextColor("#ffffff")).toBe("#000000");
    expect(getTextColor("#ffff00")).toBe("#000000"); // 黄色は明るい
  });

  it("暗い背景色には白文字を返す", () => {
    expect(getTextColor("#000000")).toBe("#ffffff");
    expect(getTextColor("#0000ff")).toBe("#ffffff"); // 青は暗い
  });

  it("先頭の # がなくても解釈できる", () => {
    expect(getTextColor("ffffff")).toBe("#000000");
    expect(getTextColor("000000")).toBe("#ffffff");
  });

  it("しきい値(brightness 186)の境界で切り替わる", () => {
    // 灰色 #bbbbbb -> brightness = 187 > 186 -> 黒
    expect(getTextColor("#bbbbbb")).toBe("#000000");
    // 灰色 #bababa -> brightness = 186 = 186 (>186 ではない) -> 白
    expect(getTextColor("#bababa")).toBe("#ffffff");
  });
});
