import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import Container from "./Container";
import type { BoardInfo } from "../../../../types/boardInfo";

// SortableContext に渡される strategy を検証したいのでスパイする。
// レンダリング自体は本物の実装（children をそのまま描画）に任せる。
vi.mock("@dnd-kit/sortable", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/sortable")>();
  return { ...actual, SortableContext: vi.fn(actual.SortableContext) };
});

const boardInfo: BoardInfo = {
  id: "b1",
  shortName: "B",
  title: "ボード",
  role: "owner",
  positions: [{ id: "p1", name: "Todo" }],
  categories: [],
  tasks: [],
};

const baseProps = {
  boardInfo,
  columnId: "col-p1",
  positionName: "Todo",
  positionIdx: 0,
  taskLength: 0,
  isLastColumn: true,
  tasks: [],
  categories: [],
  canDelete: true,
  isSelectMode: false,
  selectedTaskIds: [],
  width: undefined as number | undefined,
  onToggleSelectMode: vi.fn(),
  onToggleTaskSelect: vi.fn(),
  onSetSelectedTaskIds: vi.fn(),
  onDeleteSelected: vi.fn(),
  onDeleteTask: vi.fn(),
  onSaveTask: vi.fn(),
  onCreateCategory: vi.fn(),
  onAdvancePosition: vi.fn(),
  onResizeWidth: vi.fn(),
};

const renderContainer = (props: Partial<typeof baseProps> = {}) =>
  render(
    <DndContext>
      <Container {...baseProps} {...props} />
    </DndContext>,
  );

describe("Container（列の幅リサイズ）", () => {
  it("ハンドルをドラッグすると開始幅からの差分でonResizeWidthを呼ぶ", () => {
    const onResizeWidth = vi.fn();
    renderContainer({ onResizeWidth, width: 300 });
    const handle = screen.getByTestId("column-resize-handle");

    fireEvent.mouseDown(handle, { clientX: 100 });
    fireEvent(window, new MouseEvent("mousemove", { clientX: 150 }));

    expect(onResizeWidth).toHaveBeenCalledWith("p1", 350);
  });

  it("幅は200〜600にクランプされる", () => {
    const onResizeWidth = vi.fn();
    renderContainer({ onResizeWidth, width: 300 });
    const handle = screen.getByTestId("column-resize-handle");

    fireEvent.mouseDown(handle, { clientX: 0 });
    fireEvent(window, new MouseEvent("mousemove", { clientX: 10000 }));
    expect(onResizeWidth).toHaveBeenLastCalledWith("p1", 600);

    fireEvent(window, new MouseEvent("mousemove", { clientX: -10000 }));
    expect(onResizeWidth).toHaveBeenLastCalledWith("p1", 200);
  });

  it("mouseup後はドラッグ扱いにならない（それ以上呼ばれない）", () => {
    const onResizeWidth = vi.fn();
    renderContainer({ onResizeWidth, width: 300 });
    const handle = screen.getByTestId("column-resize-handle");

    fireEvent.mouseDown(handle, { clientX: 100 });
    fireEvent(window, new MouseEvent("mousemove", { clientX: 150 }));
    expect(onResizeWidth).toHaveBeenCalledTimes(1);

    fireEvent(window, new MouseEvent("mouseup"));
    fireEvent(window, new MouseEvent("mousemove", { clientX: 200 }));
    expect(onResizeWidth).toHaveBeenCalledTimes(1);
  });

  it("widthが指定されていればその幅をstyleに反映する", () => {
    renderContainer({ width: 321 });
    const column = screen.getByTestId("col-p1");
    // column要素の親(コンテナ本体)にインラインwidthが設定される
    expect(column.parentElement).toHaveStyle({ width: "321px" });
  });
});

describe("Container（並べ替え）", () => {
  it("複数列に折り返るグリッドに対応した rectSortingStrategy を使う", () => {
    renderContainer();
    const props = vi.mocked(SortableContext).mock.calls[0][0];
    expect(props.strategy).toBe(rectSortingStrategy);
  });
});
