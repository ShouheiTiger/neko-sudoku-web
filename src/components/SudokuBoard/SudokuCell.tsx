import { memo } from "react";
import type { CellState } from "../../types.js";

export type SudokuCellProps = {
  cell: CellState;
  index: number;
  row: number;
  col: number;
  selected: boolean;
  peer: boolean;
  onSelect: (index: number) => void;
};

// A single board cell. Pure presentation — knows nothing about Sudoku rules (§29).
function SudokuCellImpl({ cell, index, row, col, selected, peer, onSelect }: SudokuCellProps) {
  const classes = ["cell"];
  if (cell.given) classes.push("given");
  if (peer && !selected) classes.push("peer");
  if (selected) classes.push("selected");
  // thick borders on the right/bottom edge of each 3x3 box (except outer edge)
  if (col === 2 || col === 5) classes.push("box-right");
  if (row === 2 || row === 5) classes.push("box-bottom");

  const label = ariaLabel(row, col, cell);

  return (
    <button
      type="button"
      className={classes.join(" ")}
      aria-label={label}
      aria-pressed={selected}
      data-testid={`cell-${index}`}
      onClick={() => onSelect(index)}
    >
      {cell.value ?? ""}
    </button>
  );
}

// §67 aria-label style: 第R行，第C列，...
function ariaLabel(row: number, col: number, cell: CellState): string {
  const base = `第${row + 1}行，第${col + 1}列`;
  if (cell.value == null) return `${base}，空白`;
  if (cell.given) return `${base}，数字${cell.value}，题目给定`;
  return `${base}，数字${cell.value}`;
}

export const SudokuCell = memo(SudokuCellImpl);
