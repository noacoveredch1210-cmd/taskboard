import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  getMembers: vi.fn(),
  getJoinRequests: vi.fn(),
  setMemberRole: vi.fn(),
  removeMember: vi.fn(),
  approveJoinRequest: vi.fn(),
  rejectJoinRequest: vi.fn(),
  showToast: vi.fn(),
  user: { id: "u-me" } as { id: string } | null,
}));

vi.mock("../../../../api/boards", () => ({
  boardsApi: {
    getMembers: mocks.getMembers,
    getJoinRequests: mocks.getJoinRequests,
    setMemberRole: mocks.setMemberRole,
    removeMember: mocks.removeMember,
    approveJoinRequest: mocks.approveJoinRequest,
    rejectJoinRequest: mocks.rejectJoinRequest,
  },
}));
vi.mock("../../../../auth/AuthContext", () => ({
  useAuth: () => ({ user: mocks.user }),
}));
vi.mock("../../../../components/toast/ToastContext", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

import MembersModal from "./MembersModal";
import type { BoardInfo } from "../../../../types/boardInfo";
import type { BoardMemberDto } from "../../../../api/types";

const ME = "u-me";
const OTHER = "u-other";

const me = (role: "owner" | "member"): BoardMemberDto => ({
  userId: ME,
  name: "私",
  email: "me@example.com",
  role,
});
const other = (role: "owner" | "member"): BoardMemberDto => ({
  userId: OTHER,
  name: "他の人",
  email: "other@example.com",
  role,
});

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
  mocks.user = { id: ME };
  mocks.getMembers.mockResolvedValue([me("owner"), other("member")]);
  mocks.getJoinRequests.mockResolvedValue([]);
  mocks.setMemberRole.mockResolvedValue(undefined);
  mocks.removeMember.mockResolvedValue(undefined);
  mocks.approveJoinRequest.mockResolvedValue(undefined);
  mocks.rejectJoinRequest.mockResolvedValue(undefined);
});

const renderModal = (
  role: "owner" | "member" = "owner",
  onLeaveBoard = vi.fn().mockResolvedValue(true),
  onClose = vi.fn(),
) => {
  render(
    <MembersModal
      boardInfo={board(role)}
      onClose={onClose}
      onLeaveBoard={onLeaveBoard}
    />,
  );
  return { onLeaveBoard, onClose };
};

describe("MembersModal（一覧）", () => {
  it("メンバーを一覧表示し、自分には（あなた）を付ける", async () => {
    renderModal();
    expect(await screen.findByText("他の人")).toBeInTheDocument();
    expect(screen.getByText("（あなた）")).toBeInTheDocument();
    expect(screen.getByText("me@example.com")).toBeInTheDocument();
  });

  it("取得に失敗したら通知を出す", async () => {
    mocks.getMembers.mockRejectedValue(new Error("boom"));
    renderModal();
    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith(
        "メンバー情報の取得に失敗しました",
      ),
    );
  });
});

describe("MembersModal（オーナーのみの操作）", () => {
  it("メンバーには参加リクエストを取りに行かず、権限変更・除外も出さない", async () => {
    renderModal("member");
    await screen.findByText("他の人");
    expect(mocks.getJoinRequests).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "オーナーにする" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "他の人 を外す" }),
    ).not.toBeInTheDocument();
  });

  it("自分自身には権限変更・除外を出さない", async () => {
    mocks.getMembers.mockResolvedValue([me("owner")]);
    renderModal("owner");
    await screen.findByText("（あなた）");
    expect(
      screen.queryByRole("button", { name: "私 を外す" }),
    ).not.toBeInTheDocument();
  });

  it("他人をオーナーにできる（成功したら一覧を取り直す）", async () => {
    renderModal("owner");
    await user.click(
      await screen.findByRole("button", { name: "オーナーにする" }),
    );
    await waitFor(() =>
      expect(mocks.setMemberRole).toHaveBeenCalledWith(
        "board-1",
        OTHER,
        "owner",
      ),
    );
    // 初回 + 変更後の取り直し
    await waitFor(() => expect(mocks.getMembers).toHaveBeenCalledTimes(2));
  });

  it("オーナーをメンバーに戻せる", async () => {
    mocks.getMembers.mockResolvedValue([me("owner"), other("owner")]);
    renderModal("owner");
    await user.click(
      await screen.findByRole("button", { name: "メンバーに戻す" }),
    );
    await waitFor(() =>
      expect(mocks.setMemberRole).toHaveBeenCalledWith(
        "board-1",
        OTHER,
        "member",
      ),
    );
  });

  it("権限の変更に失敗したら通知を出す", async () => {
    mocks.setMemberRole.mockRejectedValue(new Error("boom"));
    renderModal("owner");
    await user.click(
      await screen.findByRole("button", { name: "オーナーにする" }),
    );
    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith("権限の変更に失敗しました"),
    );
  });
});

describe("MembersModal（除外は確認してから）", () => {
  it("キャンセルすると外さない", async () => {
    renderModal("owner");
    await user.click(await screen.findByRole("button", { name: "他の人 を外す" }));
    expect(screen.getByText("メンバーを外しますか？")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(mocks.removeMember).not.toHaveBeenCalled();
    expect(await screen.findByText("他の人")).toBeInTheDocument();
  });

  it("確認して外すと API を呼ぶ", async () => {
    renderModal("owner");
    await user.click(await screen.findByRole("button", { name: "他の人 を外す" }));
    await user.click(screen.getByRole("button", { name: "外す" }));

    await waitFor(() =>
      expect(mocks.removeMember).toHaveBeenCalledWith("board-1", OTHER),
    );
  });
});

describe("MembersModal（参加リクエスト）", () => {
  beforeEach(() => {
    mocks.getJoinRequests.mockResolvedValue([
      { userId: "u-new", name: "参加希望者", email: "new@example.com", role: "member" },
    ]);
  });

  it("オーナーには参加リクエストが出て、承認できる", async () => {
    renderModal("owner");
    expect(await screen.findByText("参加リクエスト")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "承認" }));
    await waitFor(() =>
      expect(mocks.approveJoinRequest).toHaveBeenCalledWith("board-1", "u-new"),
    );
  });

  it("却下できる", async () => {
    renderModal("owner");
    await user.click(await screen.findByRole("button", { name: "却下" }));
    await waitFor(() =>
      expect(mocks.rejectJoinRequest).toHaveBeenCalledWith("board-1", "u-new"),
    );
  });
});

describe("MembersModal（退出）", () => {
  it("メンバーは退出できる", async () => {
    mocks.getMembers.mockResolvedValue([other("owner"), me("member")]);
    renderModal("member");
    expect(
      await screen.findByRole("button", { name: "このボードから退出する" }),
    ).toBeInTheDocument();
  });

  it("最後の 1 人のオーナーは退出できない", async () => {
    mocks.getMembers.mockResolvedValue([me("owner"), other("member")]);
    renderModal("owner");
    await screen.findByText("他の人");
    expect(
      screen.queryByRole("button", { name: "このボードから退出する" }),
    ).not.toBeInTheDocument();
  });

  it("他にオーナーがいればオーナーも退出できる", async () => {
    mocks.getMembers.mockResolvedValue([me("owner"), other("owner")]);
    renderModal("owner");
    expect(
      await screen.findByRole("button", { name: "このボードから退出する" }),
    ).toBeInTheDocument();
  });

  it("確認して退出すると onLeaveBoard を呼び、成功したら閉じる", async () => {
    mocks.getMembers.mockResolvedValue([other("owner"), me("member")]);
    const { onLeaveBoard, onClose } = renderModal("member");

    await user.click(
      await screen.findByRole("button", { name: "このボードから退出する" }),
    );
    await user.click(screen.getByRole("button", { name: "退出する" }));

    await waitFor(() => expect(onLeaveBoard).toHaveBeenCalledWith("board-1"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("退出に失敗したら閉じない", async () => {
    mocks.getMembers.mockResolvedValue([other("owner"), me("member")]);
    const onLeaveBoard = vi.fn().mockResolvedValue(false);
    const { onClose } = renderModal("member", onLeaveBoard);

    await user.click(
      await screen.findByRole("button", { name: "このボードから退出する" }),
    );
    await user.click(screen.getByRole("button", { name: "退出する" }));

    await waitFor(() => expect(onLeaveBoard).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });
});
