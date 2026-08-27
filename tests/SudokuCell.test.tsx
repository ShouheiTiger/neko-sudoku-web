import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SudokuCell } from "../src/components/SudokuBoard/SudokuCell.js";
import type { CellState } from "../src/types.js";

const cell = (over: Partial<CellState> = {}): CellState => ({
  given: false,
  value: null,
  userNotes: [],
  ...over,
});

// FIX-3 (Gate Medium-3): conflict must carry a NON-color signal (§38).
describe("M2 FIX-3: conflict non-color signal", () => {
  afterEach(cleanup);

  it("conflict cell renders a non-color '!' marker", () => {
    render(
      <SudokuCell
        cell={cell({ value: 5 })}
        index={0}
        row={0}
        col={0}
        selected={false}
        peer={false}
        conflict
        hintFocus={false}
        onSelect={() => {}}
      />,
    );
    const mark = screen.getByTestId("conflict-0");
    expect(mark).toBeTruthy();
    expect(mark.textContent).toBe("!");
  });

  it("conflict cell aria-label includes 冲突", () => {
    render(
      <SudokuCell
        cell={cell({ value: 5 })}
        index={1}
        row={0}
        col={1}
        selected={false}
        peer={false}
        conflict
        hintFocus={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByTestId("cell-1").getAttribute("aria-label")).toContain("冲突");
  });

  it("non-conflict cell has NO marker and NO 冲突 in aria-label", () => {
    render(
      <SudokuCell
        cell={cell({ value: 5 })}
        index={2}
        row={0}
        col={2}
        selected={false}
        peer={false}
        conflict={false}
        hintFocus={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.queryByTestId("conflict-2")).toBeNull();
    expect(screen.getByTestId("cell-2").getAttribute("aria-label")).not.toContain("冲突");
  });

  it("marker coexists with the digit (digit still rendered)", () => {
    render(
      <SudokuCell
        cell={cell({ value: 7 })}
        index={3}
        row={0}
        col={3}
        selected={false}
        peer={false}
        conflict
        hintFocus={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByTestId("cell-3").textContent).toContain("7");
    expect(screen.getByTestId("conflict-3")).toBeTruthy();
  });
});
