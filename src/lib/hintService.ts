// M2 Hint service (adapter layer, §2/§17-§21). Wraps the FROZEN M0 Hint Engine + Solver.
// It does NOT re-implement candidates or read the solution string / userNotes.
//
// §21 elimination Hint 3: when the next logical step is an elimination (no direct
// placement), we advance the SAME logical trace via the M0 solver — solve(board, level)
// returns the ordered step list produced by the single working-candidate trace; its first
// `placement` is the next fillable cell. This resolves the M0 Low-3 without modifying Core:
//   - no solution peeking (solve never reads the solution string)
//   - no guessing / backtracking (human-logic solver only)
//   - no second candidate set (solve seeds from the Candidate Engine)
import type { BoardState, Difficulty } from "../types.js";
import { getHint, type Hint } from "../hint-engine/hint-engine.js";
import { solve, levelForDifficulty } from "../human-solver/solver.js";

export type HintFill = { cellIndex: number; digit: number };

export type HintView =
  | { available: false; reason: "solved" | "stuck" }
  | {
      available: true;
      layer: 1 | 2 | 3;
      message: string;
      focusCells: number[];
      focusUnits: number[];
      /** For layer 3 only: the cell+digit to fill, if a placement is reachable. */
      fill: HintFill | null;
      /** True when `fill` came from advancing an elimination step's trace (§21). */
      derivedFromElimination: boolean;
    };

function focusOf(hint: Hint): { focusCells: number[]; focusUnits: number[] } {
  if (hint.layer === 1) return { focusCells: hint.focusCells, focusUnits: hint.focusUnits };
  return { focusCells: hint.step.focusCells, focusUnits: hint.step.focusUnits };
}

/**
 * Compute a hint view for the given layer. Layers 1/2 pass through M0 verbatim.
 * Layer 3 returns a placement fill: directly for a placement step, or (for an
 * elimination step) the next placement from the same solver trace.
 */
export function getHintView(
  board: BoardState,
  difficulty: Difficulty,
  layer: 1 | 2 | 3,
): HintView {
  const res = getHint(board, difficulty, layer);
  if (!res.available) return { available: false, reason: res.reason };

  const hint = res.hint;
  const { focusCells, focusUnits } = focusOf(hint);

  if (layer !== 3) {
    return {
      available: true,
      layer,
      message: hint.message,
      focusCells,
      focusUnits,
      fill: null,
      derivedFromElimination: false,
    };
  }

  // layer === 3
  if (hint.layer === 3 && hint.fill) {
    // Direct placement hint.
    return {
      available: true,
      layer: 3,
      message: hint.message,
      focusCells,
      focusUnits,
      fill: hint.fill,
      derivedFromElimination: false,
    };
  }

  // Elimination step: advance the same logical trace to the next placement (§21).
  const level = levelForDifficulty(difficulty);
  const solveRes = solve(board, level);
  const firstPlacement = solveRes.steps.find((s) => s.kind === "placement");
  if (firstPlacement && firstPlacement.kind === "placement") {
    return {
      available: true,
      layer: 3,
      message: `可以确定第${Math.floor(firstPlacement.cellIndex / 9) + 1}行第${
        (firstPlacement.cellIndex % 9) + 1
      }列是 ${firstPlacement.digit}。`,
      focusCells: [firstPlacement.cellIndex],
      focusUnits,
      fill: { cellIndex: firstPlacement.cellIndex, digit: firstPlacement.digit },
      derivedFromElimination: true,
    };
  }

  // Fallback (should be unreachable for solvable dev puzzles): keep gentle guidance.
  return {
    available: true,
    layer: 3,
    message: "先按上一步排除候选，再看看会出现什么。",
    focusCells,
    focusUnits,
    fill: null,
    derivedFromElimination: true,
  };
}
