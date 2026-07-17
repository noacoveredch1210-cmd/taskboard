import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  writeText: vi.fn(),
}));

vi.mock("../../../../components/toast/ToastContext", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));
// 子モーダルは API を叩くので、開いたことだけ分かるスタブに差し替える。
vi.mock("./MembersModal", () => ({
  default: () => <div data-testid="members-modal" />,
}));
vi.mock("./TrashModal", () => ({
  default: () => <div data-testid="trash-modal" />,
}));
vi.mock("./category/CategoryModal", () => ({
  default: () => <div data-testid="category-modal" />,
}));

import BoardToolbar from "./BoardToolbar";
import type { BoardInfo } from "../../../../types/boardInfo";

const board = (role: "owner" | "member"): BoardInfo => ({
  id: "board-1",
  shortName: "B",
  title: "ボード",
  role,
  positions: [],
  categories: [],
});

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  vi.clearAllMocks();
  user = userEvent.setup();
  // navigator.clipboard は getter のみなので defineProperty で差し替える。
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: mocks.writeText },
    configurable: true,
  });
  mocks.writeText.mockResolvedValue(undefined);
});

const renderToolbar = (
  role: "owner" | "member" = "owner",
  onGetShareLink = vi.fn().mockResolvedValue("https://example.com/?join=t"),
) => {
  render(
    <BoardToolbar
      boardInfo={board(role)}
      onCreateCategory={vi.fn()}
      onSetCategory={vi.fn()}
      onDeleteCategories={vi.fn()}
      onGetShareLink={onGetShareLink}
      onLeaveBoard={vi.fn()}
      onRestoreTask={vi.fn()}
    />,
  );
  return { onGetShareLink };
};

describe("BoardToolbar（オーナー限定の出し分け）", () => {
  it("オーナーにはゴミ箱と共有リンクを出す", () => {
    renderToolbar("owner");
    expect(screen.getByRole("button", { name: /ゴミ箱/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /共有リンクをコピー/ }),
    ).toBeInTheDocument();
  });

  it("メンバーにはゴミ箱と共有リンクを出さない", () => {
    renderToolbar("member");
    expect(screen.queryByRole("button", { name: /ゴミ箱/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /共有リンクをコピー/ }),
    ).not.toBeInTheDocument();
    // カテゴリー管理とメンバーは誰でも使える
    expect(
      screen.getByRole("button", { name: "カテゴリー管理" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /メンバー/ })).toBeInTheDocument();
  });
});

describe("BoardToolbar（モーダルを開く）", () => {
  it("メンバーボタンでメンバー一覧を開く", async () => {
    renderToolbar("owner");
    expect(screen.queryByTestId("members-modal")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /メンバー/ }));
    expect(screen.getByTestId("members-modal")).toBeInTheDocument();
  });

  it("ゴミ箱ボタンでゴミ箱を開く", async () => {
    renderToolbar("owner");
    await user.click(screen.getByRole("button", { name: /ゴミ箱/ }));
    expect(screen.getByTestId("trash-modal")).toBeInTheDocument();
  });

  it("カテゴリー管理ボタンでカテゴリーを開く", async () => {
    renderToolbar("owner");
    await user.click(screen.getByRole("button", { name: "カテゴリー管理" }));
    expect(screen.getByTestId("category-modal")).toBeInTheDocument();
  });
});

describe("BoardToolbar（共有リンク）", () => {
  it("リンクを取得してクリップボードへコピーし、通知する", async () => {
    const { onGetShareLink } = renderToolbar("owner");
    await user.click(screen.getByRole("button", { name: /共有リンクをコピー/ }));

    await waitFor(() => expect(onGetShareLink).toHaveBeenCalledWith("board-1"));
    expect(mocks.writeText).toHaveBeenCalledWith("https://example.com/?join=t");
    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith("共有リンクをコピーしました"),
    );
  });

  it("取得に失敗したら通知する", async () => {
    renderToolbar("owner", vi.fn().mockRejectedValue(new Error("boom")));
    await user.click(screen.getByRole("button", { name: /共有リンクをコピー/ }));

    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith(
        "共有リンクの取得に失敗しました",
      ),
    );
    expect(mocks.writeText).not.toHaveBeenCalled();
  });

  it("コピー中は二重に押せない", async () => {
    // 解決を保留して、処理中の状態を作る。
    let resolve: (link: string) => void = () => {};
    const onGetShareLink = vi.fn(
      () => new Promise<string>((r) => (resolve = r)),
    );
    renderToolbar("owner", onGetShareLink);

    const button = screen.getByRole("button", { name: /共有リンクをコピー/ });
    await user.click(button);
    expect(button).toBeDisabled();

    resolve("https://example.com/?join=t");
    await waitFor(() => expect(button).toBeEnabled());
    expect(onGetShareLink).toHaveBeenCalledTimes(1);
  });
});
