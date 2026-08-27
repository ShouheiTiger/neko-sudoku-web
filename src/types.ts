// Neko Sudoku V1 — Core domain types.
// Source of truth: Frozen PRD & Technical Specification v2.0 (§8, §12, §20, §36, §48, §50, §72).
// M0 uses these types but does NOT implement L5/L6 techniques, puzzle bank, UI, or persistence.

/**
 * §8. Internal difficulty enum. 5 and 6 are RESERVED for future data-model
 * compatibility ONLY. V1 must not implement L5/L6 solver/hint/bank/UI (§0, §9).
 */
export type Difficulty = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * §12. Techniques allowed in V1 Human Logic Solver. This is the COMPLETE V1 set.
 * No X-Wing / Swordfish / XY-Wing / Chains (§9). Hidden Triple intentionally omitted
 * from the required V1 set (§11) — see M0 report for the decision.
 */
export type Technique =
  | "naked-single"
  | "hidden-single"
  | "locked-candidate"
  | "pointing-pair"
  | "pointing-triple"
  | "box-line-reduction"
  | "naked-pair"
  | "hidden-pair"
  | "naked-triple";

export type DifficultyAnalysis = {
  maxRequiredTechnique: Technique;
  totalSteps: number;
  nonSingleSteps: number;
  candidateEliminations: number;
};

/** §20. A single cell. userNotes is UI-only data and must NEVER feed logic (§19). */
export type CellState = {
  given: boolean;
  value: number | null;
  userNotes: number[];
};

/** §20. Board is a flat 81-length array, row-major (index = row*9 + col). */
export type BoardState = CellState[];

/** §72. */
export type PuzzleDefinition = {
  id: string;
  difficulty: Difficulty;
  puzzle: string;
  solution: string;
  givensCount: number;
  analysis: DifficultyAnalysis;
  puzzleVersion: number;
  difficultyModelVersion: number;
};

/** §36. Undo action. Included in core types; full undo stack lives in the game layer. */
export type GameAction = {
  type: "set-value" | "clear-value" | "toggle-note" | "hint-fill";
  cellIndex: number;
  before: CellState;
  after: CellState;
  timestamp: number;
};

/** §22. Result type for expected illegal user operations. */
export type MoveResult =
  | { ok: true; board: BoardState }
  | { ok: false; reason: "given-cell" | "invalid-value" | "out-of-range" };

export const BOARD_SIZE = 81;
export const UNIT = 9;
export const DIGITS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
