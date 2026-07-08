import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "./HomePage";
import type { BoardInfo } from "../../../../types/boardInfo";
import type { Category } from "../../../../types/category";
import type { UserInfo } from "../../../../types/userInfo";

const userInfo: UserInfo = { name: "山田太郎", email: "taro@example.com" };

const boards: BoardInfo[] = [
  {
    id: "b1",
    shortName: "PRJ",
    title: "プロジェクトA",
    positions: [
      { id: "p1", name: "Todo" },
      { id: "p2", name: "Done" },
    ],
  },
];

const categories: Category[] = [{ id: "c1", name: "仕事", color: "#ff0000" }];

const renderHome = () =>
  render(
    <HomePage
      userInfo={userInfo}
      boards={boards}
      categories={categories}
      onSetCategory={vi.fn()}
      onCreateCategory={vi.fn()}
      onDeleteCategories={vi.fn()}
      onSetBoard={vi.fn()}
      onCreateBoard={vi.fn()}
      onDeleteBoards={vi.fn()}
    />,
  );

describe("HomePage", () => {
  it("ユーザー情報を表示する", () => {
    renderHome();
    expect(screen.getByText("山田太郎")).toBeInTheDocument();
    expect(screen.getByText("taro@example.com")).toBeInTheDocument();
  });

  it("board 管理・カテゴリー管理のセクションを表示する", () => {
    renderHome();
    expect(screen.getByText("board 管理")).toBeInTheDocument();
    expect(screen.getByText("カテゴリー 管理")).toBeInTheDocument();
  });

  it("登録済みの board とカテゴリーを一覧表示する", () => {
    renderHome();
    expect(screen.getByText("プロジェクトA")).toBeInTheDocument(); // board タイトル
    expect(screen.getByText("PRJ")).toBeInTheDocument(); // 略称
    expect(screen.getByText("仕事")).toBeInTheDocument(); // カテゴリー名
  });
});
