import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { BoardInfo } from "../../../../types/boardInfo";
import type { UserInfo } from "../../../../types/userInfo";

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

const renderHome = () =>
  render(
    <HomePage
      userInfo={userInfo}
      boards={boards}
      onSetBoard={vi.fn()}
      onCreateBoard={vi.fn()}
      onDeleteBoards={vi.fn()}
      onJoinBoard={vi.fn()}
    />,
  );

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
});
