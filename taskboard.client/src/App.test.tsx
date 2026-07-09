import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// 認証状態による出し分けだけを見たいので、行き先の画面は差し替える。
const mocks = vi.hoisted(() => ({ useAuth: vi.fn() }));

vi.mock("./auth/AuthContext", () => ({ useAuth: mocks.useAuth }));
vi.mock("./Layout", () => ({ default: () => <div>ボード画面</div> }));
vi.mock("./auth/LoginPage", () => ({ default: () => <div>ログイン画面</div> }));

import App from "./App";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("App（認証ゲート）", () => {
  it("セッション復元中はどちらの画面も出さない", () => {
    mocks.useAuth.mockReturnValue({ loading: true, session: null });

    render(<App />);

    // ログイン画面のちらつきを防ぐため、確定するまで何も描画しない。
    expect(screen.queryByText("ログイン画面")).not.toBeInTheDocument();
    expect(screen.queryByText("ボード画面")).not.toBeInTheDocument();
  });

  it("未ログインならログイン画面を出し、ボード画面は出さない", () => {
    mocks.useAuth.mockReturnValue({ loading: false, session: null });

    render(<App />);

    expect(screen.getByText("ログイン画面")).toBeInTheDocument();
    expect(screen.queryByText("ボード画面")).not.toBeInTheDocument();
  });

  it("ログイン済みならボード画面を出す", () => {
    mocks.useAuth.mockReturnValue({
      loading: false,
      session: { access_token: "token" },
    });

    render(<App />);

    expect(screen.getByText("ボード画面")).toBeInTheDocument();
    expect(screen.queryByText("ログイン画面")).not.toBeInTheDocument();
  });

  it("セッションが復元中でも、セッションがあるだけでは描画しない", () => {
    // loading の判定が session より先に効くことを固定する。
    mocks.useAuth.mockReturnValue({
      loading: true,
      session: { access_token: "token" },
    });

    render(<App />);

    expect(screen.queryByText("ボード画面")).not.toBeInTheDocument();
  });
});
