import { describe, it, expect } from "vitest";
import { parsePuzzle } from "../src/board.js";
import { solve } from "../src/human-solver/solver.js";
import { checkUniqueness } from "../src/tools/unique-validator.js";
import { DEV_PUZZLES, puzzlesForDifficulty } from "../src/data/dev-puzzles.js";

function minSolveLevel(puzzle: string): number | null {
  const p = parsePuzzle(puzzle);
  if (!p.ok) return null;
  for (const lvl of [1, 2, 3, 4] as const) if (solve(p.board, lvl).solved) return lvl;
  return null;
}

describe("M1 dev puzzle pool (§10) — validated by M0 tools", () => {
  it("has >= 3 puzzles for each of L1..L4 and NONE for L5/L6", () => {
    for (const d of [1, 2, 3, 4] as const) {
      expect(puzzlesForDifficulty(d).length).toBeGreaterThanOrEqual(3);
    }
    expect(DEV_PUZZLES.some((p) => (p.difficulty as number) >= 5)).toBe(false);
  });

  for (const p of DEV_PUZZLES) {
    it(`${p.id}: legal, unique solution, difficulty matches solver`, () => {
      const parsed = parsePuzzle(p.puzzle);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;

      // Unique solution via the M0 validator, and it equals the declared solution.
      const u = checkUniqueness(parsed.board);
      expect(u.status).toBe("unique");
      if (u.status === "unique") expect(u.solution.join("")).toBe(p.solution);

      // Difficulty label equals the minimal human-solve level (§10 maxRequiredTechnique tier).
      expect(minSolveLevel(p.puzzle)).toBe(p.difficulty);
    });
  }
});
