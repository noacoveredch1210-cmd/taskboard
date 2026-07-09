import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BoardInfo } from "./types/boardInfo";

const mocks = vi.hoisted(() => ({
  useBoards: vi.fn(),
  useCategories: vi.fn(),
  useUser: vi.fn(),
}));

vi.mock("./hooks/useBoards", () => ({ useBoards: mocks.useBoards }));
vi.mock("./hooks/useCategories", () => ({
  useCategories: mocks.useCategories,
}));
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
  positions: [],
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
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useBoards.mockReturnValue(boardsState());
  mocks.useCategories.mockReturnValue({
    categories: [],
    setCategory: vi.fn(),
    createCategory: vi.fn(),
    deleteCategories: vi.fn(),
  });
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
});

describe("Layout（board が 0 件のときの初回モーダル）", () => {
  it("board が無ければ、ロード完了時にボード作成モーダルを出す", () => {
    mocks.useBoards.mockReturnValue(boardsState({ boards: [] }));

    render(<Layout />);

    expect(screen.getByText("ボード作成モーダル")).toBeInTheDocument();
  });

  it("board があればモーダルは出さない", () => {
    render(<Layout />);

    expect(screen.queryByText("ボード作成モーダル")).not.toBeInTheDocument();
  });

  it("一度閉じたら、board が再び 0 件になっても開き直さない", async () => {
    const user = userEvent.setup();
    mocks.useBoards.mockReturnValue(boardsState({ boards: [] }));

    const { rerender } = render(<Layout />);
    await user.click(screen.getByRole("button", { name: "モーダルを閉じる" }));
    expect(screen.queryByText("ボード作成モーダル")).not.toBeInTheDocument();

    // board を作って、また全部消す。件数が 0 → 1 → 0 と動くので
    // 自動表示の useEffect は再実行されるが、二度目は出さない。
    mocks.useBoards.mockReturnValue(boardsState({ boards: [board] }));
    rerender(<Layout />);
    mocks.useBoards.mockReturnValue(boardsState({ boards: [] }));
    rerender(<Layout />);

    expect(screen.queryByText("ボード作成モーダル")).not.toBeInTheDocument();
  });

  it("ロードが終わるまではモーダルを出さない", () => {
    mocks.useBoards.mockReturnValue(boardsState({ loaded: false, boards: [] }));

    render(<Layout />);

    // 空配列の初期状態を「board が 0 件」と誤認しないこと。
    expect(screen.queryByText("ボード作成モーダル")).not.toBeInTheDocument();
  });
});
