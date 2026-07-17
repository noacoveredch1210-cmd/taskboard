import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  getMembers: vi.fn(),
  report: vi.fn(),
}));

vi.mock("../api/boards", () => ({ boardsApi: { getMembers: mocks.getMembers } }));
vi.mock("../hooks/reportError", () => ({
  reportError: (message: string) => () => mocks.report(message),
}));

import MemberAvatars from "./MemberAvatars";
import type { BoardMemberDto } from "../api/types";

const member = (i: number, role: "owner" | "member" = "member"): BoardMemberDto => ({
  userId: `u-${i}`,
  name: `メンバー${i}`,
  email: `m${i}@example.com`,
  role,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MemberAvatars", () => {
  it("メンバーを取得してアイコンを並べる", async () => {
    mocks.getMembers.mockResolvedValue([member(1, "owner"), member(2)]);
    render(<MemberAvatars boardId="board-1" />);

    expect(await screen.findByLabelText("参加者")).toBeInTheDocument();
    expect(mocks.getMembers).toHaveBeenCalledWith("board-1");
    // 役割が分かるように title を付けている
    expect(screen.getByTitle("メンバー1（オーナー）")).toBeInTheDocument();
    expect(screen.getByTitle("メンバー2（メンバー）")).toBeInTheDocument();
  });

  it("メンバーが居なければ何も描画しない", async () => {
    mocks.getMembers.mockResolvedValue([]);
    const { container } = render(<MemberAvatars boardId="board-1" />);
    await waitFor(() => expect(mocks.getMembers).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("6 人以上なら 5 人だけ出して残りを +n で示す", async () => {
    mocks.getMembers.mockResolvedValue([1, 2, 3, 4, 5, 6, 7].map((i) => member(i)));
    render(<MemberAvatars boardId="board-1" />);

    expect(await screen.findByText("+2")).toBeInTheDocument();
    expect(screen.getByTitle("メンバー5（メンバー）")).toBeInTheDocument();
    expect(screen.queryByTitle("メンバー6（メンバー）")).not.toBeInTheDocument();
  });

  it("ちょうど 5 人なら +n を出さない", async () => {
    mocks.getMembers.mockResolvedValue([1, 2, 3, 4, 5].map((i) => member(i)));
    render(<MemberAvatars boardId="board-1" />);

    await screen.findByLabelText("参加者");
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it("取得に失敗しても落ちず、何も描画しない", async () => {
    mocks.getMembers.mockRejectedValue(new Error("boom"));
    const { container } = render(<MemberAvatars boardId="board-1" />);

    await waitFor(() =>
      expect(mocks.report).toHaveBeenCalledWith("メンバーの取得に失敗しました"),
    );
    expect(container).toBeEmptyDOMElement();
  });
});
