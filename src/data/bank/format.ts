// Neko Sudoku V1 — Production Puzzle Bank shared format & constants.
// Source of truth for the bank shape used by BOTH the offline generator/validator
// (scripts/, run under tsx) AND the runtime loader (src/data/bank/loader.ts) and tests.
//
// Release Prep constraints (V1 instructions §5, §11, §13, §15):
//   - 1200 puzzles total: L1=200, L2=300, L3=400, L4=300.
//   - Difficulty is decided by the FROZEN Human Logic Solver / Analyzer, never clue count.
//   - Technique boundary per level is enforced against the FROZEN Technique union.
//   - Stable IDs: v1-l{level}-{0001..}. No runtime generation.
import { z } from "zod";
import type { Technique } from "../../types.js";

/** §13/§33 Bank version. Bump only when the committed bank data changes. */
export const BANK_VERSION = "v1";

/** §5 Frozen per-level counts. */
export const BANK_COUNTS: Record<1 | 2 | 3 | 4, number> = { 1: 200, 2: 300, 3: 400, 4: 300 };
export const BANK_TOTAL = 1200;

/**
 * §11 V1 technique boundary — the highest tier a puzzle at each level is ALLOWED to require.
 * A puzzle is valid for level L iff its `maxRequiredTechnique` is in the allowed set for L
 * AND it is NOT solvable at L-1 (difficulty purity, §10). These names mirror the frozen
 * `Technique` union exactly (src/types.ts §12).
 */
export const ALLOWED_TECHNIQUES: Record<1 | 2 | 3 | 4, ReadonlySet<Technique>> = {
  1: new Set<Technique>(["naked-single"]),
  2: new Set<Technique>(["naked-single", "hidden-single"]),
  3: new Set<Technique>([
    "naked-single",
    "hidden-single",
    "locked-candidate",
    "pointing-pair",
    "pointing-triple",
    "box-line-reduction",
  ]),
  4: new Set<Technique>([
    "naked-single",
    "hidden-single",
    "locked-candidate",
    "pointing-pair",
    "pointing-triple",
    "box-line-reduction",
    "naked-pair",
    "hidden-pair",
    "naked-triple",
  ]),
};

/** Techniques V1 must NEVER require (§11). Documented for the validator's boundary check. */
export const FORBIDDEN_TECHNIQUES = new Set<string>([
  "hidden-triple",
  "x-wing",
  "swordfish",
  "xy-wing",
  "chain",
  "coloring",
  "guess",
  "backtracking",
]);

/** §15 Stable production puzzle id, e.g. "v1-l3-0042". */
export function puzzleId(level: 1 | 2 | 3 | 4, ordinal: number): string {
  return `${BANK_VERSION}-l${level}-${String(ordinal).padStart(4, "0")}`;
}

// ---- §13 ProductionPuzzle schema (also used for runtime lightweight validation) ----
export const analysisSchema = z.object({
  maxRequiredTechnique: z.string().min(1),
  totalSteps: z.number().int().min(0),
  nonSingleSteps: z.number().int().min(0),
  candidateEliminations: z.number().int().min(0),
});

export const productionPuzzleSchema = z.object({
  id: z.string().regex(/^v1-l[1-4]-\d{4}$/),
  bankVersion: z.literal(BANK_VERSION),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  puzzle: z.string().length(81).regex(/^[0-9]{81}$/),
  solution: z.string().length(81).regex(/^[1-9]{81}$/),
  analysis: analysisSchema,
});
export type ProductionPuzzle = z.infer<typeof productionPuzzleSchema>;

/** A per-level bank file: { bankVersion, difficulty, puzzles }. */
export const bankLevelSchema = z.object({
  bankVersion: z.literal(BANK_VERSION),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  puzzles: z.array(productionPuzzleSchema),
});
export type BankLevel = z.infer<typeof bankLevelSchema>;
