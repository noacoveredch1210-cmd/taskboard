import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Loading from "./Loading";

describe("Loading", () => {
  it("読み込み中であることを表示する", () => {
    render(<Loading />);

    expect(screen.getByText("Now Loading")).toBeInTheDocument();
  });
});
