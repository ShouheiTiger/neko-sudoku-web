// §15.2 HUMAN LOGIC SOLVER. Proves a puzzle is solvable using only the techniques
// allowed at a given difficulty (§11). NO guessing / backtracking (§15.2).
//
// Candidates originate exclusively from the Candidate Engine (§17): the solver seeds a
// working candidate grid via seedWorking() (which calls getAllCandidates) and then
// mutates that ONE grid as techniques fire. There is no second candidate algorithm.
import type { BoardState, Difficulty, Technique } from "../types.js";
import type { LogicStep } from "./logic-step.js";
import type { CandidateMap } from "../candidate-engine.js";
import {
  seedWorking,
  applyPlacement,
  applyEliminations,
  type WorkingCandidates,
} from "./working-candidates.js";
import {
  nakedSingle,
  hiddenSingle,
  pointing,
  boxLineReduction,
  nakedPair,
  nakedTriple,
  hiddenPair,
} from "./techniques.js";

type Finder = (b: BoardState, c: CandidateMap) => LogicStep | null;

/**
 * Technique tiers in strict escalation order. minLevel = the lowest difficulty at
 * which the technique is allowed (§11). V1 stops at L4; no L5/L6 techniques (§9).
 */
export const TECHNIQUE_TIER: ReadonlyArray<{ finder: Finder; technique: Technique; minLevel: 1 | 2 | 3 | 4 }> = [
  { finder: nakedSingle, technique: "naked-single", minLevel: 1 },
  { finder: hiddenSingle, technique: "hidden-single", minLevel: 2 },
  { finder: pointing, technique: "pointing-pair", minLevel: 3 },
  { finder: boxLineReduction, technique: "box-line-reduction", minLevel: 3 },
  { finder: nakedPair, technique: "naked-pair", minLevel: 4 },
  { finder: hiddenPair, technique: "hidden-pair", minLevel: 4 },
  { finder: nakedTriple, technique: "naked-triple", minLevel: 4 },
];

/** V1 human-logic level per difficulty. 5/6 reserved -> capped at L4 techniques (§9). */
export function levelForDifficulty(d: Difficulty): 1 | 2 | 3 | 4 {
  return d >= 4 ? 4 : (d as 1 | 2 | 3);
}

/**
 * Find the next logical step against a given working-candidate grid, using techniques
 * up to maxLevel, cheapest-first. Shared primitive for Solver AND Hint (§17/§26).
 */
export function findStep(
  board: BoardState,
  working: WorkingCandidates,
  maxLevel: 1 | 2 | 3 | 4,
): LogicStep | null {
  for (const tier of TECHNIQUE_TIER) {
    if (tier.minLevel > maxLevel) continue;
    const step = tier.finder(board, working);
    if (step) return step;
  }
  return null;
}

/**
 * §23 Convenience for callers that want the next step from a fresh board (Hint uses
 * this). Seeds the working grid from the Candidate Engine, then finds one step.
 */
export function findNextStep(board: BoardState, maxLevel: 1 | 2 | 3 | 4): LogicStep | null {
  return findStep(board, seedWorking(board), maxLevel);
}

export type SolveResult = {
  solved: boolean;
  steps: LogicStep[];
  finalBoard: BoardState;
  stuck: boolean;
};

/**
 * Fully solve using only techniques up to maxLevel. Placements mutate the board copy;
 * eliminations mutate the working grid. If neither placement progress nor elimination
 * progress can be made, the puzzle is "stuck" at this level.
 */
export function solve(board: BoardState, maxLevel: 1 | 2 | 3 | 4): SolveResult {
  const current = board.map((c) => ({ ...c, userNotes: [...c.userNotes] }));
  const working = seedWorking(current);
  const steps: LogicStep[] = [];
  const MAX_ITERS = 5000;

  for (let iter = 0; iter < MAX_ITERS; iter++) {
    if (current.every((c) => c.value != null)) {
      return { solved: true, steps, finalBoard: current, stuck: false };
    }
    const step = findStep(current, working, maxLevel);
    if (!step) return { solved: false, steps, finalBoard: current, stuck: true };

    if (step.kind === "placement") {
      current[step.cellIndex] = { given: false, value: step.digit, userNotes: [] };
      applyPlacement(working, step.cellIndex, step.digit);
      steps.push(step);
    } else {
      const changed = applyEliminations(working, step.eliminations);
      if (!changed) {
        // Technique reported eliminations that were already applied -> no progress.
        return { solved: false, steps, finalBoard: current, stuck: true };
      }
      steps.push(step);
    }
  }
  return { solved: false, steps, finalBoard: current, stuck: true };
}

/** §16.5/§16.6 Highest technique actually required to solve at the given level. */
export function maxRequiredTechnique(steps: LogicStep[]): Technique | null {
  let max: Technique | null = null;
  let maxRank = -1;
  for (const s of steps) {
    const rank = TECHNIQUE_TIER.findIndex((t) => t.technique === s.technique);
    // pointing-triple shares tier with pointing-pair; treat by its own technique name.
    const effectiveRank = rank >= 0 ? rank : rankOfTechnique(s.technique);
    if (effectiveRank > maxRank) {
      maxRank = effectiveRank;
      max = s.technique;
    }
  }
  return max;
}

function rankOfTechnique(t: Technique): number {
  const order: Technique[] = [
    "naked-single",
    "hidden-single",
    "locked-candidate",
    "pointing-pair",
    "pointing-triple",
    "box-line-reduction",
    "naked-pair",
    "hidden-pair",
    "naked-triple",
  ];
  return order.indexOf(t);
}
