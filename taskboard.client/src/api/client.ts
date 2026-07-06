const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

/** API がエラーステータスを返したときに投げられる例外 */
export class ApiError extends Error {
  readonly status: number;
  /** サーバーが返したエラーボディ（JSON または テキスト） */
  readonly body?: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

const request = async <T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
): Promise<T> => {
  const hasBody = body !== undefined;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: hasBody ? { "Content-Type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorBody = await parseBody(res);
    throw new ApiError(
      res.status,
      `API ${method} ${path} failed with status ${res.status}`,
      errorBody,
    );
  }

  // 204 No Content など、ボディが無いレスポンス
  if (res.status === 204) return undefined as T;
  return (await parseBody(res)) as T;
};

/** レスポンスボディを JSON として、失敗したらテキストとして読む */
const parseBody = async (res: Response): Promise<unknown> => {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/** クエリ文字列を組み立てる（undefined の値は除外） */
export const toQuery = (
  params: Record<string, string | number | undefined>,
): string => {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== "",
  );
  if (entries.length === 0) return "";
  const search = new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)]),
  );
  return `?${search.toString()}`;
};

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
