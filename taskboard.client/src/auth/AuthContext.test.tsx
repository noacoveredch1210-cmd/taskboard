import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  renderHook,
  screen,
  act,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { AuthProvider, useAuth } from "./AuthContext";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({ supabase: { auth } }));

/** onAuthStateChange に渡されたコールバック（購読後にテストから発火する） */
let notifyAuthChange: (event: AuthChangeEvent, session: Session | null) => void;
const unsubscribe = vi.fn();

const sessionFixture = (over: Partial<Session> = {}) =>
  ({
    access_token: "token-abc",
    user: { id: "user-1", email: "taro@example.com" },
    ...over,
  }) as Session;

const Probe = () => {
  const { loading, session, user, signInWithGoogle, signOut } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="token">{session?.access_token ?? "none"}</span>
      <span data-testid="email">{user?.email ?? "none"}</span>
      <button onClick={() => void signInWithGoogle()}>ログイン</button>
      <button onClick={() => void signOut()}>ログアウト</button>
    </div>
  );
};

/** Provider をマウントし、初期セッション復元の完了まで待つ */
const renderProvider = async () => {
  const result = render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() =>
    expect(screen.getByTestId("loading")).toHaveTextContent("false"),
  );
  return result;
};

/**
 * context の値を直接取り出す。signInWithGoogle / signOut の reject は
 * ボタンのハンドラ内に留まって assert できないため、こちらから呼ぶ。
 */
const renderCapture = async () => {
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result.current;
};

beforeEach(() => {
  // afterEach ではなく beforeEach でクリアする。setup.ts の cleanup() は
  // テスト側の afterEach より後に走り、そのアンマウントで unsubscribe が
  // 呼ばれるため、afterEach でクリアすると次のテストへ漏れる。
  vi.clearAllMocks();

  auth.getSession.mockResolvedValue({ data: { session: null } });
  auth.onAuthStateChange.mockImplementation((cb: typeof notifyAuthChange) => {
    notifyAuthChange = cb;
    return { data: { subscription: { unsubscribe } } };
  });
  auth.signInWithOAuth.mockResolvedValue({ error: null });
  auth.signOut.mockResolvedValue({ error: null });
});

describe("AuthProvider - 初期化", () => {
  it("セッション取得が終わるまで loading は true", async () => {
    let resolveSession!: (value: { data: { session: Session | null } }) => void;
    auth.getSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByTestId("loading")).toHaveTextContent("true");

    await act(async () => resolveSession({ data: { session: null } }));
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("既存セッションを復元し、user を session.user から導出する", async () => {
    auth.getSession.mockResolvedValue({ data: { session: sessionFixture() } });

    await renderProvider();

    expect(screen.getByTestId("token")).toHaveTextContent("token-abc");
    expect(screen.getByTestId("email")).toHaveTextContent("taro@example.com");
  });

  it("未ログインなら session も user も null", async () => {
    await renderProvider();

    expect(screen.getByTestId("token")).toHaveTextContent("none");
    expect(screen.getByTestId("email")).toHaveTextContent("none");
  });
});

describe("AuthProvider - 認証状態の購読", () => {
  it("ログイン通知でセッションを反映する", async () => {
    await renderProvider();

    act(() => notifyAuthChange("SIGNED_IN", sessionFixture()));

    expect(screen.getByTestId("token")).toHaveTextContent("token-abc");
    expect(screen.getByTestId("email")).toHaveTextContent("taro@example.com");
  });

  it("ログアウト通知でセッションを消す", async () => {
    auth.getSession.mockResolvedValue({ data: { session: sessionFixture() } });
    await renderProvider();

    act(() => notifyAuthChange("SIGNED_OUT", null));

    expect(screen.getByTestId("token")).toHaveTextContent("none");
    expect(screen.getByTestId("email")).toHaveTextContent("none");
  });

  it("トークン更新通知で新しいトークンに差し替える", async () => {
    auth.getSession.mockResolvedValue({ data: { session: sessionFixture() } });
    await renderProvider();

    act(() =>
      notifyAuthChange(
        "TOKEN_REFRESHED",
        sessionFixture({ access_token: "token-new" }),
      ),
    );

    expect(screen.getByTestId("token")).toHaveTextContent("token-new");
  });

  it("アンマウント時に購読を解除する", async () => {
    const { unmount } = await renderProvider();
    expect(unsubscribe).not.toHaveBeenCalled();

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe("signInWithGoogle", () => {
  it("google プロバイダと現在のオリジンへのリダイレクトで呼ぶ", async () => {
    await renderProvider();

    await userEvent.click(screen.getByRole("button", { name: "ログイン" }));

    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  });

  it("Supabase がエラーを返したら throw する", async () => {
    auth.signInWithOAuth.mockResolvedValue({ error: new Error("oauth failed") });
    const { signInWithGoogle } = await renderCapture();

    await expect(signInWithGoogle()).rejects.toThrow("oauth failed");
  });
});

describe("signOut", () => {
  it("Supabase の signOut を呼ぶ", async () => {
    await renderProvider();

    await userEvent.click(screen.getByRole("button", { name: "ログアウト" }));

    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("Supabase がエラーを返したら throw する", async () => {
    auth.signOut.mockResolvedValue({ error: new Error("signout failed") });
    const { signOut } = await renderCapture();

    await expect(signOut()).rejects.toThrow("signout failed");
  });
});

describe("useAuth", () => {
  it("AuthProvider の外で使うと throw する", () => {
    // React が投げた例外をコンソールに出さない
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow(
      "useAuth は AuthProvider の内側で使ってください。",
    );

    spy.mockRestore();
  });
});
