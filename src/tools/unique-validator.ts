// §15.1 UNIQUE SOLUTION VALIDATOR — machine verifier, NOT player logic (§15.2).
//
// Uses plain backtracking/DFS. This is explicitly allowed here and ONLY here.
// Backtracking / guessing must never appear as a Human Logic step (§15.2).
// Lives under tools/ to keep it separate from the runtime human-logic packages (§75).
import type { BoardState } from "../types.js";
import { getPeers } from "../grid.js";

/** Solve as an integer array (0 = empty). Counts solutions up to `limit`. */
function countSolutions(cells: number[], limit: number): { count: number; first: number[] | null } {
  let count = 0;
  let first: number[] | null = null;

  // Precompute peers list once (imported table is already precomputed).
  const search = (grid: number[]): boolean => {
    // find empty cell with fewest candidates (MRV) for speed
    let best = -1;
    let bestCands: number[] = [];
    for (let i = 0; i < 81; i++) {
      if (grid[i] !== 0) continue;
      const used = new Set<number>();
      for (const p of getPeers(i)) if (grid[p] !== 0) used.add(grid[p]!);
      const cands: number[] = [];
      for (let d = 1; d <= 9; d++) if (!used.has(d)) cands.push(d);
      if (cands.length === 0) return false; // dead end
      if (best === -1 || cands.length < bestCands.length) {
        best = i;
        bestCands = cands;
        if (cands.length === 1) break;
      }
    }
    if (best === -1) {
      // solved
      count++;
      if (!first) first = grid.slice();
      return count >= limit;
    }
    for (const d of bestCands) {
      grid[best] = d;
      const stop = search(grid);
      grid[best] = 0;
      if (stop) return true;
    }
    return false;
  };

  search(cells.slice());
  return { count, first };
}

export type UniquenessResult =
  | { status: "unique"; solution: number[] }
  | { status: "no-solution" }
  | { status: "multiple" };

/** §15.1 Prove a puzzle has exactly one solution. */
export function checkUniqueness(board: BoardState): UniquenessResult {
  const cells = board.map((c) => c.value ?? 0);
  const { count, first } = countSolutions(cells, 2);
  if (count === 0) return { status: "no-solution" };
  if (count >= 2) return { status: "multiple" };
  return { status: "unique", solution: first! };
}

/** Convenience: does this puzzle have a unique solution? */
export function hasUniqueSolution(board: BoardState): boolean {
  return checkUniqueness(board).status === "unique";
}
