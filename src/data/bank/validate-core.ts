// Shared Production Puzzle validation logic (§17, §64).
// Used by BOTH scripts/validate-puzzles.ts (full 1200 CLI gate) and tests/production-bank.test.ts.
// Every check delegates to the FROZEN M0 core (parsePuzzle / checkUniqueness / analyze / solve).
import { parsePuzzle } from "../../board.js";
import { checkUniqueness } from "../../tools/unique-validator.js";
import { analyze } from "../../difficulty/analyze.js";
import { solve } from "../../human-solver/solver.js";
import {
  ALLOWED_TECHNIQUES,
  BANK_VERSION,
  productionPuzzleSchema,
  type ProductionPuzzle,
} from "./format.js";

export type PuzzleIssue = { id: string; problem: string };

/** Validate a single production puzzle against ALL §17 structural + logic requirements. */
export function validatePuzzle(p: ProductionPuzzle, level: 1 | 2 | 3 | 4): PuzzleIssue[] {
  const issues: PuzzleIssue[] = [];
  const fail = (problem: string) => issues.push({ id: p.id, problem });

  // Schema shape (length, charset, bankVersion, id pattern).
  const shape = productionPuzzleSchema.safeParse(p);
  if (!shape.success) {
    fail(`schema: ${shape.error.issues.map((i) => i.message).join("; ")}`);
    return issues; // further checks unsafe if shape is wrong
  }
  if (p.bankVersion !== BANK_VERSION) fail(`bankVersion != ${BANK_VERSION}`);
  if (p.difficulty !== level) fail(`difficulty ${p.difficulty} != file level ${level}`);

  // givens legal + parseable (no direct conflicts).
  const parsed = parsePuzzle(p.puzzle);
  if (!parsed.ok) {
    fail(`puzzle unparseable: ${parsed.reason}`);
    return issues;
  }

  // solution: legal complete grid, and consistent with givens.
  const solParsed = parsePuzzle(p.solution);
  if (!solParsed.ok) fail(`solution unparseable: ${solParsed.reason}`);
  else {
    if (solParsed.board.some((c) => c.value == null)) fail("solution not complete");
    // givens must match the solution at every given cell.
    for (let i = 0; i < 81; i++) {
      const g = parsed.board[i]!.value;
      if (g != null && g !== solParsed.board[i]!.value) {
        fail(`given at ${i} disagrees with solution`);
        break;
      }
    }
  }

  // exactly one solution (machine validator, DFS).
  const uniq = checkUniqueness(parsed.board);
  if (uniq.status !== "unique") fail(`uniqueness: ${uniq.status}`);
  else {
    const uniqStr = uniq.solution.join("");
    if (uniqStr !== p.solution) fail("unique solution differs from stored solution");
  }

  // Human-logic solvable + difficulty purity + technique boundary + metadata consistency.
  const res = analyze(parsed.board);
  if (!res.ok) {
    fail("not solvable by V1 human logic (would need L5/L6)");
  } else {
    if (res.solvedAtLevel !== level) fail(`solves at L${res.solvedAtLevel}, not exactly L${level}`);
    // purity: must NOT be solvable one level below (redundant with solvedAtLevel but explicit).
    if (level > 1) {
      const below = solve(parsed.board, (level - 1) as 1 | 2 | 3);
      if (below.solved) fail(`solvable at L${level - 1} (not pure for L${level})`);
    }
    // technique boundary.
    if (!ALLOWED_TECHNIQUES[level].has(res.analysis.maxRequiredTechnique as never)) {
      fail(`maxRequiredTechnique "${res.analysis.maxRequiredTechnique}" not allowed at L${level}`);
    }
    // analysis metadata consistency with the frozen analyzer.
    const a = res.analysis;
    if (
      a.maxRequiredTechnique !== p.analysis.maxRequiredTechnique ||
      a.totalSteps !== p.analysis.totalSteps ||
      a.nonSingleSteps !== p.analysis.nonSingleSteps ||
      a.candidateEliminations !== p.analysis.candidateEliminations
    ) {
      fail("analysis metadata inconsistent with frozen analyzer");
    }
  }

  return issues;
}
