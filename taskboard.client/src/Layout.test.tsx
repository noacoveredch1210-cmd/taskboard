import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { BoardInfo } from "./types/boardInfo";

const mocks = vi.hoisted(() => ({
  useBoards: vi.fn(),
  useUser: vi.fn(),
}));

vi.mock("./hooks/useBoards", () => ({ useBoards: mocks.useBoards }));
vi.mock("./hooks/useUser", () => ({ useUser: mocks.useUser }));

// 子画面は Layout の関心事ではないので差し替える。
vi.mock("./features/header/index.tsx", () => ({
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("./features/sidebar/index.tsx", () => ({
  default: () => <div>サイドバー</div>,
}));
vi.mock("./features/pages/index.tsx", () => ({
  default: () => <div>ページ本体</div>,
}));
vi.mock("./features/AI/index.tsx", () => ({
  default: () => <div>AIパネル</div>,
}));
vi.mock("./features/pages/components/home/board/BoardModal.tsx", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div>
      <span>ボード作成モーダル</span>
      <button type="button" onClick={onClose}>
        モーダルを閉じる
      </button>
    </div>
  ),
}));

import Layout from "./Layout";

const board: BoardInfo = {
  id: "b1",
  shortName: "A",
  title: "ボードA",
  role: "owner",
  positions: [],
  categories: [],
  tasks: [],
};

/** useBoards の戻り値を組み立てる（既定は「ロード済み・board が 1 件」）。 */
const boardsState = (over: Partial<ReturnType<typeof baseBoards>> = {}) => ({
  ...baseBoards(),
  ...over,
});

const baseBoards = () => ({
  boards: [board],
  loaded: true,
  error: false,
  saveTask: vi.fn(),
  setBoard: vi.fn(),
  createBoard: vi.fn(),
  deleteBoards: vi.fn(),
  reorderTasks: vi.fn(),
  commitTaskMove: vi.fn(),
  deleteTasks: vi.fn(),
  createCategory: vi.fn(),
  setCategory: vi.fn(),
  deleteCategories: vi.fn(),
  getShareLink: vi.fn(),
  joinBoard: vi.fn(),
  leaveBoard: vi.fn(),
  restoreTask: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useBoards.mockReturnValue(boardsState());
  mocks.useUser.mockReturnValue({ name: "山田太郎", email: "taro@ex.com" });
});

describe("Layout（初期状態の出し分け）", () => {
  it("初回取得に失敗したらエラー画面だけを出す", () => {
    mocks.useBoards.mockReturnValue(
      boardsState({ error: true, loaded: true, boards: [] }),
    );

    render(<Layout />);

    expect(screen.getByText("データを取得できませんでした")).toBeInTheDocument();
    expect(screen.queryByText("ページ本体")).not.toBeInTheDocument();
  });

  it("ロード中はローディング画面だけを出す", () => {
    mocks.useBoards.mockReturnValue(boardsState({ loaded: false, boards: [] }));

    render(<Layout />);

    expect(screen.getByText("Now Loading")).toBeInTheDocument();
    expect(screen.queryByText("ページ本体")).not.toBeInTheDocument();
  });

  it("取得に失敗していたら、ロード中の判定より先にエラー画面を出す", () => {
    mocks.useBoards.mockReturnValue(boardsState({ error: true, loaded: false }));

    render(<Layout />);

    expect(screen.getByText("データを取得できませんでした")).toBeInTheDocument();
    expect(screen.queryByText("Now Loading")).not.toBeInTheDocument();
  });

  it("ロード後はアプリ本体を出し、初期表示はホーム画面にする", () => {
    render(<Layout />);

    expect(screen.getByText("ページ本体")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ホーム画面" })).toBeInTheDocument();
  });

  it("board が 0 件でも作成モーダルは自動表示しない（参加者の邪魔をしない）", () => {
    mocks.useBoards.mockReturnValue(boardsState({ boards: [] }));

    render(<Layout />);

    expect(screen.getByText("ページ本体")).toBeInTheDocument();
    expect(screen.queryByText("ボード作成モーダル")).not.toBeInTheDocument();
  });
});
