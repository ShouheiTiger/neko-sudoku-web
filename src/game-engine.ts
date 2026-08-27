// §21/§22 Game Engine — pure functions. UI must call these; never re-implement Sudoku rules in onClick.
import type { BoardState, MoveResult } from "./types.js";
import { getPeers } from "./grid.js";
import { cloneBoard, findConflicts } from "./board.js";

/** §21 setValue. Returns Result for expected illegal ops (§22); does not mutate input. */
export function setValue(board: BoardState, cellIndex: number, value: number): MoveResult {
  if (cellIndex < 0 || cellIndex >= board.length) return { ok: false, reason: "out-of-range" };
  if (board[cellIndex]!.given) return { ok: false, reason: "given-cell" };
  if (!Number.isInteger(value) || value < 1 || value > 9)
    return { ok: false, reason: "invalid-value" };
  const next = cloneBoard(board);
  next[cellIndex] = { ...next[cellIndex]!, value, userNotes: [] };
  return { ok: true, board: next };
}

/** §21 clearValue. */
export function clearValue(board: BoardState, cellIndex: number): MoveResult {
  if (cellIndex < 0 || cellIndex >= board.length) return { ok: false, reason: "out-of-range" };
  if (board[cellIndex]!.given) return { ok: false, reason: "given-cell" };
  const next = cloneBoard(board);
  next[cellIndex] = { ...next[cellIndex]!, value: null };
  return { ok: true, board: next };
}

/** §21/§32 toggleNote — UI-only userNotes. Never used by logic (§19). */
export function toggleNote(board: BoardState, cellIndex: number, note: number): MoveResult {
  if (cellIndex < 0 || cellIndex >= board.length) return { ok: false, reason: "out-of-range" };
  if (board[cellIndex]!.given) return { ok: false, reason: "given-cell" };
  if (!Number.isInteger(note) || note < 1 || note > 9)
    return { ok: false, reason: "invalid-value" };
  const next = cloneBoard(board);
  const cell = next[cellIndex]!;
  const notes = new Set(cell.userNotes);
  if (notes.has(note)) notes.delete(note);
  else notes.add(note);
  next[cellIndex] = { ...cell, userNotes: [...notes].sort((a, b) => a - b) };
  return { ok: true, board: next };
}

export { getPeers };

/** §21 getConflicts. */
export function getConflicts(board: BoardState): number[] {
  return findConflicts(board);
}

/** §21 validateBoard — filled, no conflicts. */
export function validateBoard(board: BoardState): { complete: boolean; conflicts: number[] } {
  const conflicts = findConflicts(board);
  const filled = board.every((c) => c.value != null);
  return { complete: filled && conflicts.length === 0, conflicts };
}

/** §21 isCompleted. */
export function isCompleted(board: BoardState): boolean {
  return validateBoard(board).complete;
}
