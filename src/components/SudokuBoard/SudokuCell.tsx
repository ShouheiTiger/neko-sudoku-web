import { memo } from "react";
import type { CellState } from "../../types.js";

export type SudokuCellProps = {
  cell: CellState;
  index: number;
  row: number;
  col: number;
  selected: boolean;
  peer: boolean;
  /** Cell participates in a row/col/box conflict (light styling only, §12). */
  conflict: boolean;
  /** Highlighted by an active hint (§18). */
  hintFocus: boolean;
  onSelect: (index: number) => void;
};

// A single board cell. Pure presentation — knows nothing about Sudoku rules (§29).
function SudokuCellImpl({
  cell,
  index,
  row,
  col,
  selected,
  peer,
  conflict,
  hintFocus,
  onSelect,
}: SudokuCellProps) {
  const classes = ["cell"];
  if (cell.given) classes.push("given");
  if (peer && !selected) classes.push("peer");
  if (selected) classes.push("selected");
  if (conflict) classes.push("conflict");
  if (hintFocus) classes.push("hint-focus");
  if (col === 2 || col === 5) classes.push("box-right");
  if (row === 2 || row === 5) classes.push("box-bottom");

  const label = ariaLabel(row, col, cell, conflict);
  const showNotes = cell.value == null && cell.userNotes.length > 0;

  return (
    <button
      type="button"
      className={classes.join(" ")}
      aria-label={label}
      aria-pressed={selected}
      data-testid={`cell-${index}`}
      onClick={() => onSelect(index)}
    >
      {/* FIX-3 (Gate Medium-3): non-color conflict signal — a small "!" marker so the
          conflict state does not rely on color alone (§38). Subtle & gentle, corner-anchored
          so it never covers the digit or the 3x3 notes. Screen readers get the "冲突" text
          from aria-label below (this marker is aria-hidden to avoid double reading). */}
      {conflict && (
        <span className="conflict-mark" data-testid={`conflict-${index}`} aria-hidden="true">
          !
        </span>
      )}
      {cell.value != null ? (
        <span className="cell-value" data-testid={`value-${index}`}>{cell.value}</span>
      ) : showNotes ? (
        // §5 candidate notes shown as digits 1-9 in a 3x3 mini-grid (NEVER dots).
        <span className="notes" data-testid={`notes-${index}`} aria-hidden="true">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <span key={n} className="note-cell">
              {cell.userNotes.includes(n) ? n : ""}
            </span>
          ))}
        </span>
      ) : (
        ""
      )}
    </button>
  );
}

// §67 aria-label style: 第R行，第C列，... FIX-3 appends "，冲突" so screen readers perceive
// the conflict state without relying on color.
function ariaLabel(row: number, col: number, cell: CellState, conflict: boolean): string {
  const base = `第${row + 1}行，第${col + 1}列`;
  const suffix = conflict ? "，冲突" : "";
  if (cell.value == null) {
    if (cell.userNotes.length > 0) return `${base}，候选 ${cell.userNotes.join("、")}${suffix}`;
    return `${base}，空白${suffix}`;
  }
  if (cell.given) return `${base}，数字${cell.value}，题目给定${suffix}`;
  return `${base}，数字${cell.value}${suffix}`;
}

export const SudokuCell = memo(SudokuCellImpl);
