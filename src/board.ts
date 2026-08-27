// §73 Puzzle string parsing/validation + board construction.
import type { BoardState, CellState } from "./types.js";
import { BOARD_SIZE } from "./types.js";
import { ALL_UNITS } from "./grid.js";

export type ParseResult =
  | { ok: true; board: BoardState }
  | { ok: false; reason: "bad-length" | "bad-char" | "givens-conflict" };

/** §73 A puzzle string is 81 chars, '0'/'.' = empty, '1'-'9' = given. */
export function parsePuzzle(puzzle: string): ParseResult {
  if (puzzle.length !== BOARD_SIZE) return { ok: false, reason: "bad-length" };
  const board: BoardState = [];
  for (const ch of puzzle) {
    if (ch === "0" || ch === ".") {
      board.push({ given: false, value: null, userNotes: [] });
    } else if (ch >= "1" && ch <= "9") {
      board.push({ given: true, value: Number(ch), userNotes: [] });
    } else {
      return { ok: false, reason: "bad-char" };
    }
  }
  if (findConflicts(board).length > 0) return { ok: false, reason: "givens-conflict" };
  return { ok: true, board };
}

/** §21 getConflicts — indices participating in a row/col/box duplication. */
export function findConflicts(board: BoardState): number[] {
  const conflicting = new Set<number>();
  for (const unit of ALL_UNITS) {
    const seen = new Map<number, number[]>();
    for (const idx of unit) {
      const v = board[idx]!.value;
      if (v == null) continue;
      const arr = seen.get(v) ?? [];
      arr.push(idx);
      seen.set(v, arr);
    }
    for (const arr of seen.values())
      if (arr.length > 1) for (const idx of arr) conflicting.add(idx);
  }
  return [...conflicting].sort((a, b) => a - b);
}

export function cloneBoard(board: BoardState): BoardState {
  return board.map(
    (c): CellState => ({ given: c.given, value: c.value, userNotes: [...c.userNotes] }),
  );
}

/** §73 Serialize board values back to an 81-char string (0 = empty). */
export function boardToString(board: BoardState): string {
  return board.map((c) => (c.value == null ? "0" : String(c.value))).join("");
}
