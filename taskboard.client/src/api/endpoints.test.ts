// 各リソースモジュールが「どのメソッドで・どのパスを」叩くかを検証する。
// HTTP の実挙動は client.test.ts が担当するため、ここでは api を差し替える。

import { describe, it, expect, vi, beforeEach } from "vitest";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

// toQuery は本物を使う（クエリ文字列の組み立てまで含めて検証したいため）
vi.mock("./client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./client")>()),
  api: apiMock,
}));

import { tasksApi } from "./tasks";
import { positionsApi } from "./positions";
import { boardsApi } from "./boards";
import { categoriesApi } from "./categories";
import { usersApi } from "./users";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createResource が生成する CRUD", () => {
  it.each([
    ["tasksApi", tasksApi, "/tasks"],
    ["positionsApi", positionsApi, "/positions"],
    ["boardsApi", boardsApi, "/boards"],
    ["categoriesApi", categoriesApi, "/categories"],
  ] as const)("%s は %s 配下の CRUD パスを叩く", (_name, resource, basePath) => {
    resource.getById("id-1");
    expect(apiMock.get).toHaveBeenCalledWith(`${basePath}/id-1`);

    resource.create({ id: "id-1" } as never);
    expect(apiMock.post).toHaveBeenCalledWith(basePath, { id: "id-1" });

    resource.update("id-1", { name: "更新後" } as never);
    expect(apiMock.put).toHaveBeenCalledWith(`${basePath}/id-1`, {
      name: "更新後",
    });

    resource.remove("id-1");
    expect(apiMock.delete).toHaveBeenCalledWith(`${basePath}/id-1`);
  });

  it("api の戻り値をそのまま返す", async () => {
    apiMock.get.mockResolvedValue({ id: "t1" });

    await expect(tasksApi.getById("t1")).resolves.toEqual({ id: "t1" });
  });
});

describe("リソース固有の取得", () => {
  it("tasksApi.getByBoard は boardId をクエリに載せる", () => {
    tasksApi.getByBoard("b1");
    expect(apiMock.get).toHaveBeenCalledWith("/tasks?boardId=b1");
  });

  it("positionsApi.getByBoard は boardId をクエリに載せる", () => {
    positionsApi.getByBoard("b1");
    expect(apiMock.get).toHaveBeenCalledWith("/positions?boardId=b1");
  });

  it("boardsApi.getMine はクエリ無しで /boards を叩く（対象はトークンから決まる）", () => {
    boardsApi.getMine();
    expect(apiMock.get).toHaveBeenCalledWith("/boards");
  });

  it("categoriesApi.getMine はクエリ無しで /categories を叩く", () => {
    categoriesApi.getMine();
    expect(apiMock.get).toHaveBeenCalledWith("/categories");
  });
});

describe("usersApi", () => {
  it("getMe は /users/me を GET する", () => {
    usersApi.getMe();
    expect(apiMock.get).toHaveBeenCalledWith("/users/me");
  });

  it("updateMe は /users/me へ PUT する", () => {
    usersApi.updateMe({ name: "新名", email: "a@example.com" });
    expect(apiMock.put).toHaveBeenCalledWith("/users/me", {
      name: "新名",
      email: "a@example.com",
    });
  });
});
