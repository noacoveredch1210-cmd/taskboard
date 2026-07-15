import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { BoardInfo } from "../../../../types/boardInfo";
import type { UserInfo } from "../../../../types/userInfo";
import userEvent from "@testing-library/user-event";

vi.mock("./LogoutButton", () => ({ default: () => <div>ログアウト</div> }));
vi.mock("./DeleteAccountButton", () => ({
  default: () => <div>退会する</div>,
}));
vi.mock("./JoinBoardButton", () => ({
  default: () => <div>共有リンクで参加</div>,
}));

import HomePage from "./HomePage";

const userInfo: UserInfo = { name: "山田太郎", email: "taro@example.com" };

const boards: BoardInfo[] = [
  {
    id: "b1",
    shortName: "PRJ",
    title: "プロジェクトA",
    role: "owner",
    positions: [
      { id: "p1", name: "Todo" },
      { id: "p2", name: "Done" },
    ],
    categories: [],
  },
];

const renderWith = (boardList: BoardInfo[]) =>
  render(
    <HomePage
      userInfo={userInfo}
      boards={boardList}
      onSetBoard={vi.fn()}
      onCreateBoard={vi.fn()}
      onDeleteBoards={vi.fn()}
      onJoinBoard={vi.fn()}
    />,
  );

const renderHome = () => renderWith(boards);

// 各テストごとに新しい user を用意し、入力状態がテスト間で漏れないようにする
let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
  localStorage.clear(); // ウェルカム表示フラグをテスト間で持ち越さない
});

describe("HomePage", () => {
  it("ユーザー情報を表示する", () => {
    renderHome();
    expect(screen.getByText("山田太郎")).toBeInTheDocument();
    expect(screen.getByText("taro@example.com")).toBeInTheDocument();
  });

  it("board 管理セクションと登録済みの board を表示する", () => {
    renderHome();
    expect(screen.getByText("board 管理")).toBeInTheDocument();
    expect(screen.getByText("プロジェクトA")).toBeInTheDocument(); // board タイトル
    expect(screen.getByText("PRJ")).toBeInTheDocument(); // 略称
  });

  it("カテゴリー管理はホームに置かない（ボード単位に移動した）", () => {
    renderHome();
    expect(screen.queryByText("カテゴリー 管理")).not.toBeInTheDocument();
  });

  it("共有リンクで参加・ログアウト・退会の導線を表示する", () => {
    renderHome();
    expect(screen.getByText("共有リンクで参加")).toBeInTheDocument();
    expect(screen.getByText("ログアウト")).toBeInTheDocument();
    expect(screen.getByText("退会する")).toBeInTheDocument();
  });

  it("追加ボタンで board 追加モーダルを開く", async () => {
    renderHome();
    await user.click(screen.getByText("ボードの追加").closest("button")!);
    expect(screen.getByText("board 追加")).toBeInTheDocument();
  });
});

describe("HomePage（起動時ウェルカム）", () => {
  const welcomeTitle = "TaskBoard へようこそ 🎉";

  it("board が 0 件なら起動時にウェルカムを表示する", () => {
    renderWith([]);
    expect(screen.getByText(welcomeTitle)).toBeInTheDocument();
  });

  it("board があればウェルカムを出さない", () => {
    renderHome();
    expect(screen.queryByText(welcomeTitle)).not.toBeInTheDocument();
  });

  it("「あとで」で閉じる", async () => {
    renderWith([]);
    await user.click(screen.getByRole("button", { name: "あとで" }));
    expect(screen.queryByText(welcomeTitle)).not.toBeInTheDocument();
  });

  it("「ボードを作る」でウェルカムを閉じ、作成モーダルを開く", async () => {
    renderWith([]);
    await user.click(screen.getByRole("button", { name: "ボードを作る" }));
    expect(screen.queryByText(welcomeTitle)).not.toBeInTheDocument();
    expect(screen.getByText("board 追加")).toBeInTheDocument(); // 作成モーダル
  });
});
