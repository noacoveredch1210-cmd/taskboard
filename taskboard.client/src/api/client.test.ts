import { describe, it, expect } from "vitest";
import { toQuery, ApiError } from "./client";

describe("toQuery", () => {
  it("パラメータが無ければ空文字を返す", () => {
    expect(toQuery({})).toBe("");
  });

  it("undefined と空文字の値は除外する", () => {
    expect(toQuery({ a: undefined, b: "", c: "x" })).toBe("?c=x");
  });

  it("全て除外されたら空文字を返す", () => {
    expect(toQuery({ a: undefined, b: "" })).toBe("");
  });

  it("数値は文字列化して連結する", () => {
    expect(toQuery({ page: 2, size: 10 })).toBe("?page=2&size=10");
  });

  it("値をURLエンコードする", () => {
    expect(toQuery({ q: "a b&c" })).toBe("?q=a+b%26c");
  });
});

describe("ApiError", () => {
  it("status・message・body を保持し Error を継承する", () => {
    const err = new ApiError(404, "not found", { detail: "x" });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ApiError");
    expect(err.status).toBe(404);
    expect(err.message).toBe("not found");
    expect(err.body).toEqual({ detail: "x" });
  });
});
