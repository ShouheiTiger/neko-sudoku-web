// §17/§18 Working candidate grid. Seeded EXCLUSIVELY from the Candidate Engine
// (getAllCandidates). Elimination techniques mutate this working grid; placements
// remove the digit from peers. This keeps ONE candidate algorithm (the engine) while
// allowing a human-style solve where eliminations accumulate. userNotes never involved.
import type { BoardState } from "../types.js";
import { getAllCandidates } from "../candidate-engine.js";
import { getPeers } from "../grid.js";

export type WorkingCandidates = Map<number, Set<number>>;

/** Build a mutable working grid seeded from the Candidate Engine. */
export function seedWorking(board: BoardState): WorkingCandidates {
  const base = getAllCandidates(board);
  const w: WorkingCandidates = new Map();
  for (const [i, s] of base) w.set(i, new Set(s));
  return w;
}

/** Apply a placement to the working grid: cell resolved, digit removed from peers. */
export function applyPlacement(w: WorkingCandidates, cellIndex: number, digit: number): void {
  w.delete(cellIndex);
  for (const p of getPeers(cellIndex)) w.get(p)?.delete(digit);
}

/** Apply eliminations to the working grid. Returns true if anything changed. */
export function applyEliminations(
  w: WorkingCandidates,
  elims: ReadonlyArray<{ cellIndex: number; digit: number }>,
): boolean {
  let changed = false;
  for (const e of elims) {
    if (w.get(e.cellIndex)?.delete(e.digit)) changed = true;
  }
  return changed;
}
