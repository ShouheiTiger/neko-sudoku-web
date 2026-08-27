// §10-§14 DIFFICULTY ANALYSIS. Derived from the solve trace (§10 metrics), NOT from a
// fixed logicScore weighting (§13) and NOT from givens count alone (§10).
import type { BoardState, DifficultyAnalysis } from "../types.js";
import { solve, maxRequiredTechnique } from "../human-solver/solver.js";
import { SINGLE_TECHNIQUES } from "../human-solver/logic-step.js";

export type AnalyzeResult =
  | { ok: true; analysis: DifficultyAnalysis; solvedAtLevel: 1 | 2 | 3 | 4 }
  | { ok: false; reason: "unsolvable-by-human-logic" };

/**
 * Analyze a puzzle by solving it at the minimum level that succeeds (L1->L4), then
 * reporting the §12 metrics. Returns failure if not solvable within V1 human logic
 * (i.e. would require L5/L6 — which V1 does not implement, §9).
 */
export function analyze(board: BoardState): AnalyzeResult {
  for (const level of [1, 2, 3, 4] as const) {
    const res = solve(board, level);
    if (!res.solved) continue;

    const max = maxRequiredTechnique(res.steps);
    if (max == null) {
      // Already solved / empty step trace (e.g. board already complete).
      return {
        ok: true,
        solvedAtLevel: level,
        analysis: {
          maxRequiredTechnique: "naked-single",
          totalSteps: 0,
          nonSingleSteps: 0,
          candidateEliminations: 0,
        },
      };
    }

    const totalSteps = res.steps.length;
    const nonSingleSteps = res.steps.filter((s) => !SINGLE_TECHNIQUES.has(s.technique)).length;
    const candidateEliminations = res.steps.reduce(
      (sum, s) => sum + (s.kind === "elimination" ? s.eliminations.length : 0),
      0,
    );

    return {
      ok: true,
      solvedAtLevel: level,
      analysis: { maxRequiredTechnique: max, totalSteps, nonSingleSteps, candidateEliminations },
    };
  }
  return { ok: false, reason: "unsolvable-by-human-logic" };
}
