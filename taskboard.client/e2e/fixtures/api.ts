import type { Page, Route } from "@playwright/test";
import { TEST_USER } from "./auth";

export type ApiState = {
  boards: {
    id: string;
    shortName: string;
    title: string;
    role: "owner" | "member";
  }[];
  positions: {
    id: string;
    boardId: string;
    name: string;
    orderIndex: number;
  }[];
  tasks: {
    id: string;
    boardId: string;
    positionId: string | null;
    categoryId: string | null;
    name: string;
    comment: string | null;
    importance: number | null;
    deadline: string | null;
    orderIndex: number;
  }[];
  categories: { id: string; name: string; color: string }[];
  members: {
    userId: string;
    name: string;
    email: string;
    role: "owner" | "member";
  }[];
};

/** 記録された更新系リクエスト（テストから検証する） */
export type RecordedRequest = {
  method: string;
  path: string;
  body: unknown;
};

/**
 * .env.e2e の VITE_API_BASE_URL に対応する。
 * `**\/api/**` のような緩いパターンだと、Vite が配信するソース（/src/api/*.ts）まで
 * 拾ってしまうため、API のオリジンごと固定する。
 */
const API_PATTERN = "http://localhost:5000/api/**";

export const BOARD_ID = "10000000-0000-4000-8000-000000000001";
export const POS_TODO = "20000000-0000-4000-8000-000000000001";
export const POS_DONE = "20000000-0000-4000-8000-000000000002";
export const TASK_A = "30000000-0000-4000-8000-00000000000a";
export const TASK_B = "30000000-0000-4000-8000-00000000000b";
export const TASK_C = "30000000-0000-4000-8000-00000000000c";

/** タスク 2 件（どちらも Todo 列）を持つボード 1 枚。 */
export const defaultState = (): ApiState => ({
  boards: [
    { id: BOARD_ID, shortName: "E2E", title: "E2Eボード", role: "owner" },
  ],
  positions: [
    { id: POS_TODO, boardId: BOARD_ID, name: "Todo", orderIndex: 0 },
    { id: POS_DONE, boardId: BOARD_ID, name: "Done", orderIndex: 1 },
  ],
  tasks: [
    {
      id: TASK_A,
      boardId: BOARD_ID,
      positionId: POS_TODO,
      categoryId: null,
      name: "タスクA",
      comment: null,
      importance: 0,
      deadline: null,
      orderIndex: 0,
    },
    {
      id: TASK_B,
      boardId: BOARD_ID,
      positionId: POS_TODO,
      categoryId: null,
      name: "タスクB",
      comment: null,
      importance: 0,
      deadline: null,
      orderIndex: 1,
    },
  ],
  categories: [],
  // ボードを開くと担当者アバターのためにメンバーを取る（自分 1 人＝オーナー）。
  members: [
    {
      userId: TEST_USER.id,
      name: TEST_USER.name,
      email: TEST_USER.email,
      role: "owner",
    },
  ],
});

type Options = {
  /** true を返した呼び出しだけ 500 を返す（失敗時の挙動を確かめる） */
  failWhen?: (method: string, path: string) => boolean;
};

/**
 * /api/** を差し替える。実サーバーと同じ形（一覧はクエリで絞り込み、
 * 更新系は 204 No Content）を返す。
 */
export const stubApi = async (
  page: Page,
  state: ApiState = defaultState(),
  options: Options = {},
) => {
  const recorded: RecordedRequest[] = [];

  // クライアントは別オリジン（:5000）の API を Authorization 付きで叩くため、
  // 実サーバーと同じく CORS を許可しないとブラウザがレスポンスを捨てる。
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
  };

  const json = (route: Route, body: unknown) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: corsHeaders,
      body: JSON.stringify(body),
    });

  await page.route(API_PATTERN, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, "");

    // プリフライト
    if (method === "OPTIONS") {
      return route.fulfill({ status: 204, headers: corsHeaders, body: "" });
    }

    if (method !== "GET") {
      recorded.push({
        method,
        path,
        body: request.postData() ? JSON.parse(request.postData()!) : undefined,
      });
    }

    if (options.failWhen?.(method, path)) {
      return route.fulfill({ status: 500, headers: corsHeaders, body: "" });
    }

    // ---- GET ----
    if (method === "GET") {
      if (path === "/users/me") {
        return json(route, { name: TEST_USER.name, email: TEST_USER.email });
      }
      if (path === "/boards") {
        // 実サーバーと同じく、中身（列・タスク・カテゴリー・メンバー）ごと返す。
        return json(
          route,
          state.boards.map((board) => ({
            ...board,
            positions: state.positions.filter((p) => p.boardId === board.id),
            tasks: state.tasks.filter((t) => t.boardId === board.id),
            categories: state.categories,
            members: state.members,
          })),
        );
      }
      if (/^\/boards\/[^/]+\/members$/.test(path)) {
        return json(route, state.members);
      }
      if (path === "/categories") return json(route, state.categories);
      if (path === "/positions") {
        const boardId = url.searchParams.get("boardId");
        return json(
          route,
          state.positions.filter((p) => p.boardId === boardId),
        );
      }
      if (path === "/tasks") {
        const boardId = url.searchParams.get("boardId");
        return json(
          route,
          state.tasks.filter((t) => t.boardId === boardId),
        );
      }
    }

    // ---- 更新系（本文は state に反映しないが、成功として返す）----
    if (method === "POST") return json(route, {});
    if (method === "PUT" || method === "DELETE") {
      return route.fulfill({ status: 204, headers: corsHeaders, body: "" });
    }

    return route.fulfill({ status: 404, headers: corsHeaders, body: "" });
  });

  return {
    /** 記録された更新系リクエスト */
    requests: recorded,
    /** 指定のメソッド・パス接頭辞に一致する記録を返す */
    find: (method: string, pathPrefix: string) =>
      recorded.filter(
        (r) => r.method === method && r.path.startsWith(pathPrefix),
      ),
    /** 記録を捨てる（初期ロード分を数えたくないとき） */
    clear: () => recorded.splice(0, recorded.length),
  };
};
