import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CharCounter from "./CharCounter";

describe("CharCounter", () => {
  it("「現在/上限」の形式で表示する", () => {
    render(<CharCounter current={12} max={40} />);
    expect(screen.getByText("12/40")).toBeInTheDocument();
  });

  it("十分に余裕があるときは灰色", () => {
    render(<CharCounter current={0} max={40} />);
    expect(screen.getByText("0/40")).toHaveClass("text-gray-400");
  });

  it("上限の90%以上で警告色(amber)になる", () => {
    render(<CharCounter current={36} max={40} />);
    expect(screen.getByText("36/40")).toHaveClass("text-amber-600");
  });

  it("上限に達すると赤色になる", () => {
    render(<CharCounter current={40} max={40} />);
    expect(screen.getByText("40/40")).toHaveClass("text-red-500");
  });
});
