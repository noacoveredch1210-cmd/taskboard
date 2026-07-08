import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DeleteModal from "./DeleteModal";

// 各テストごとに新しい user を用意し、入力状態がテスト間で漏れないようにする
let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
});

describe("DeleteModal", () => {
  it("メッセージと不可逆の注記を表示する", () => {
    render(
      <DeleteModal message="削除しますか？" onConfirm={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByText("削除しますか？")).toBeInTheDocument();
    expect(screen.getByText("※この処理は元には戻せません。")).toBeInTheDocument();
  });

  it("irreversible=false で注記を隠す", () => {
    render(
      <DeleteModal irreversible={false} onConfirm={vi.fn()} onClose={vi.fn()} />,
    );
    expect(
      screen.queryByText("※この処理は元には戻せません。"),
    ).not.toBeInTheDocument();
  });

  it("「いいえ」で onClose だけ呼ぶ", async () => {    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<DeleteModal onConfirm={onConfirm} onClose={onClose} />);
    await user.click(screen.getByText("いいえ"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("「はい」で onConfirm と onClose を呼ぶ", async () => {    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<DeleteModal onConfirm={onConfirm} onClose={onClose} />);
    await user.click(screen.getByText("はい"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
