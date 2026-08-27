// §17/§18/§19 CANDIDATE ENGINE — P0 ARCHITECTURAL RED LINE.
//
// This module is the ONE AND ONLY source of logical candidates for the whole system.
// Both the Human Solver and the Hint Engine MUST obtain candidates from here.
// It computes candidates dynamically from BoardState.
//
// It MUST NOT read `userNotes` (§19): logical candidates are independent of what the
// user did or did not write. Neither the Solver nor Hint may maintain a separate
// candidate algorithm (§17).
import type { BoardState } from "./types.js";
import { DIGITS } from "./types.js";
import { getPeers } from "./grid.js";

export type CandidateMap = ReadonlyMap<number, ReadonlySet<number>>;

/**
 * §18 getCandidates(board, cellIndex): the digits that can legally go in a cell
 * given the current placed values of its peers. Filled cells return an empty set.
 * NOTE: intentionally ignores board[i].userNotes.
 */
export function getCandidates(board: BoardState, cellIndex: number): ReadonlySet<number> {
  const cell = board[cellIndex]!;
  if (cell.value != null) return new Set<number>();
  const used = new Set<number>();
  for (const p of getPeers(cellIndex)) {
    const v = board[p]!.value;
    if (v != null) used.add(v);
  }
  const out = new Set<number>();
  for (const d of DIGITS) if (!used.has(d)) out.add(d);
  return out;
}

/** §18 getAllCandidates(board): map of every empty cell -> its candidate set. */
export function getAllCandidates(board: BoardState): CandidateMap {
  const map = new Map<number, ReadonlySet<number>>();
  for (let i = 0; i < board.length; i++) {
    if (board[i]!.value == null) map.set(i, getCandidates(board, i));
  }
  return map;
}
