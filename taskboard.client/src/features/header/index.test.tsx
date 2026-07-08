import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Header from "./index";

describe("Header", () => {
  it("タイトルを表示する", () => {
    render(<Header title="マイボード" />);
    expect(screen.getByText("マイボード")).toBeInTheDocument();
  });
});
