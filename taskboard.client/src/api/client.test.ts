import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, toQuery, ApiError } from "./client";

// client.ts は毎リクエスト supabase の現在セッションを読むため、認証部分を差し替える。
const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("../lib/supabase", () => ({
  supabase: { auth: { getSession } },
}));

// vite.config.ts の test.env で注入している値
const BASE_URL = "http://localhost:5000/api";

let fetchMock: ReturnType<typeof vi.fn>;

/**
 * fetch が返す Response を差し替える。
 * Response のボディは一度しか読めないため、呼び出しごとに作り直す。
 */
const respondWith = (body: BodyInit | null, init?: ResponseInit) =>
  fetchMock.mockImplementation(async () => new Response(body, init));

/** 直近の fetch 呼び出しの [url, init] */
const lastRequest = () => {
  const call = fetchMock.mock.calls.at(-1);
  return { url: call![0] as string, init: call![1] as RequestInit };
};

const useSession = (accessToken: string) =>
  getSession.mockResolvedValue({ data: { session: { access_token: accessToken } } });

const useNoSession = () => getSession.mockResolvedValue({ data: { session: null } });

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  useNoSession();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

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

describe("api - リクエストの組み立て", () => {
  it("BASE_URL とパスを連結して呼ぶ", async () => {
    respondWith(JSON.stringify({ ok: true }));

    await api.get("/tasks?boardId=b1");

    expect(lastRequest().url).toBe(`${BASE_URL}/tasks?boardId=b1`);
  });

  it.each([
    ["get", () => api.get("/x"), "GET"],
    ["post", () => api.post("/x"), "POST"],
    ["put", () => api.put("/x"), "PUT"],
    ["delete", () => api.delete("/x"), "DELETE"],
  ])("api.%s は %s メソッドで送る", async (_name, call, method) => {
    respondWith(null, { status: 204 });

    await call();

    expect(lastRequest().init.method).toBe(method);
  });

  it("ボディがあれば JSON 文字列化し Content-Type を付ける", async () => {
    respondWith(JSON.stringify({}));

    await api.post("/tasks", { name: "タスク" });

    const { init } = lastRequest();
    expect(init.body).toBe('{"name":"タスク"}');
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
  });

  it("ボディが無ければ Content-Type を付けず body も送らない", async () => {
    respondWith(null, { status: 204 });

    await api.delete("/tasks/t1");

    const { init } = lastRequest();
    expect(init.body).toBeUndefined();
    expect(init.headers).not.toHaveProperty("Content-Type");
  });

  it("セッションがあれば Bearer トークンを付ける", async () => {
    useSession("token-abc");
    respondWith(JSON.stringify({}));

    await api.get("/users/me");

    expect(lastRequest().init.headers).toMatchObject({
      Authorization: "Bearer token-abc",
    });
  });

  it("セッションが無ければ Authorization を付けない", async () => {
    respondWith(JSON.stringify({}));

    await api.get("/users/me");

    expect(lastRequest().init.headers).not.toHaveProperty("Authorization");
  });

  it("リクエストごとに最新のセッションを読む（トークン更新に追随する）", async () => {
    respondWith(JSON.stringify({}));

    useSession("old-token");
    await api.get("/users/me");
    useSession("new-token");
    await api.get("/users/me");

    expect(getSession).toHaveBeenCalledTimes(2);
    expect(lastRequest().init.headers).toMatchObject({
      Authorization: "Bearer new-token",
    });
  });
});

describe("api - レスポンスの解釈", () => {
  it("JSON ボディをパースして返す", async () => {
    respondWith(JSON.stringify([{ id: "t1" }]));

    await expect(api.get("/tasks")).resolves.toEqual([{ id: "t1" }]);
  });

  it("204 No Content は undefined を返す", async () => {
    respondWith(null, { status: 204 });

    await expect(api.put("/tasks/t1", { name: "x" })).resolves.toBeUndefined();
  });

  it("空ボディの 200 も undefined を返す", async () => {
    respondWith("");

    await expect(api.get("/tasks")).resolves.toBeUndefined();
  });

  it("JSON として読めないボディはテキストのまま返す", async () => {
    respondWith("plain text");

    await expect(api.get("/tasks")).resolves.toBe("plain text");
  });
});

describe("api - エラー処理", () => {
  it("エラーステータスなら ApiError を投げ、status と JSON ボディを保持する", async () => {
    respondWith(JSON.stringify({ detail: "invalid" }), { status: 400 });

    const err = await api.post("/tasks", {}).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(400);
    expect((err as ApiError).body).toEqual({ detail: "invalid" });
  });

  it("メソッドとパスとステータスを含むメッセージにする", async () => {
    respondWith("", { status: 404 });

    const err = await api.get("/tasks/none").catch((e: unknown) => e);

    expect((err as ApiError).message).toBe(
      "API GET /tasks/none failed with status 404",
    );
  });

  it("エラーボディがテキストならそのまま保持する", async () => {
    respondWith("Internal Server Error", { status: 500 });

    const err = await api.get("/tasks").catch((e: unknown) => e);

    expect((err as ApiError).body).toBe("Internal Server Error");
  });

  it("エラーボディが空なら body は undefined", async () => {
    respondWith("", { status: 401 });

    const err = await api.get("/tasks").catch((e: unknown) => e);

    expect((err as ApiError).body).toBeUndefined();
  });

  it("fetch 自体の失敗（ネットワークエラー）はそのまま伝播する", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(api.get("/tasks")).rejects.toThrow("Failed to fetch");
  });
});
