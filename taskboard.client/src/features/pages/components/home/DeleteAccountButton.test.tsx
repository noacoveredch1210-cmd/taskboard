import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  deleteMe: vi.fn(),
  signOut: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("../../../../api", () => ({ usersApi: { deleteMe: mocks.deleteMe } }));
vi.mock("../../../../auth/AuthContext", () => ({
  useAuth: () => ({ signOut: mocks.signOut }),
}));
vi.mock("../../../../components/toast/ToastContext", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

import DeleteAccountButton from "./DeleteAccountButton";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleteMe.mockResolvedValue(undefined);
  mocks.signOut.mockResolvedValue(undefined);
});

const openModal = async () => {
  const user = userEvent.setup();
  render(<DeleteAccountButton />);
  await user.click(screen.getByRole("button", { name: "アプリを退会する" }));
  return user;
};

describe("DeleteAccountButton", () => {
  it("最初は確認モーダルを出さない", () => {
    render(<DeleteAccountButton />);
    expect(screen.queryByText("本当に退会しますか？")).not.toBeInTheDocument();
  });

  it("押すと確認モーダルを開く（この時点では削除しない）", async () => {
    await openModal();

    expect(screen.getByText("本当に退会しますか？")).toBeInTheDocument();
    expect(mocks.deleteMe).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("キャンセルすると削除せずモーダルを閉じる", async () => {
    const user = await openModal();

    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(mocks.deleteMe).not.toHaveBeenCalled();
    expect(screen.queryByText("本当に退会しますか？")).not.toBeInTheDocument();
  });

  it("確定するとデータを削除してからサインアウトする", async () => {
    const order: string[] = [];
    mocks.deleteMe.mockImplementation(() => {
      order.push("delete");
      return Promise.resolve();
    });
    mocks.signOut.mockImplementation(() => {
      order.push("signOut");
      return Promise.resolve();
    });
    const user = await openModal();

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "退会する" }));

    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1));
    // 削除 → サインアウトの順（逆だと削除前にセッションが切れる）
    expect(order).toEqual(["delete", "signOut"]);
  });

  it("削除に失敗したらサインアウトせず通知する", async () => {
    mocks.deleteMe.mockRejectedValue(new Error("boom"));
    const user = await openModal();

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "退会する" }));

    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith(
        "退会処理に失敗しました。時間をおいて再度お試しください。",
      ),
    );
    expect(mocks.signOut).not.toHaveBeenCalled();
    // モーダルは開いたまま（再試行できる）
    expect(screen.getByText("本当に退会しますか？")).toBeInTheDocument();
  });
});
