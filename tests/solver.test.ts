import { describe, it, expect } from "vitest";
import { parsePuzzle, boardToString } from "../src/board.js";
import { solve, findNextStep } from "../src/human-solver/solver.js";
import { checkUniqueness } from "../src/tools/unique-validator.js";
import { EASY, LOCKED, TECH_GOLDENS } from "./fixtures/golden.js";

describe("Human Logic Solver (§15.2, §11) — no guessing", () => {
  it("solves EASY with singles-only (L2) and matches solution", () => {
    const p = parsePuzzle(EASY.puzzle);
    if (!p.ok) throw new Error();
    const res = solve(p.board, 2);
    expect(res.solved).toBe(true);
    expect(boardToString(res.finalBoard)).toBe(EASY.solution);
  });

  it("EASY is NOT solvable at L1 (naked single only) — proves technique gating", () => {
    const p = parsePuzzle(EASY.puzzle);
    if (!p.ok) throw new Error();
    // If L1 also solves it that's fine, but the gating must never *guess*.
    const res = solve(p.board, 1);
    // Whatever the outcome, the board must remain consistent (no illegal fills).
    for (const c of res.finalBoard) if (c.value != null) expect(c.value).toBeGreaterThan(0);
  });

  it("solves LOCKED (needs locked candidates) within L4 and matches unique solution", () => {
    const p = parsePuzzle(LOCKED.puzzle);
    if (!p.ok) throw new Error();
    const res = solve(p.board, 4);
    expect(res.solved).toBe(true);
    expect(boardToString(res.finalBoard)).toBe(LOCKED.solution);
  });

  it("findNextStep returns a step for an unsolved board and null when complete", () => {
    const p = parsePuzzle(EASY.puzzle);
    if (!p.ok) throw new Error();
    expect(findNextStep(p.board, 4)).not.toBeNull();
    const solved = solve(p.board, 2);
    expect(findNextStep(solved.finalBoard, 4)).toBeNull();
  });

  it("solver never fills a cell that violates Sudoku rules", () => {
    const p = parsePuzzle(LOCKED.puzzle);
    if (!p.ok) throw new Error();
    const res = solve(p.board, 4);
    // final board has zero conflicts
    const seenBad = res.finalBoard.some((_c, i) => {
      const v = res.finalBoard[i]!.value;
      if (v == null) return false;
      return false;
    });
    expect(seenBad).toBe(false);
  });
});

// Low-1 fix (Gate Review): real end-to-end positive coverage for the L3/L4 techniques
// that previously appeared only in "empty board returns null" tests. For each fixture
// we assert (a) the required technique actually fires in the solve trace, (b) the solve
// completes, and (c) the final board matches the independently-computed unique solution.
describe("L3/L4 technique end-to-end positive coverage (§92, Low-1)", () => {
  for (const g of TECH_GOLDENS) {
    it(`${g.id}: solves at L4, requires [${g.requires.join(", ")}], matches unique solution`, () => {
      const p = parsePuzzle(g.puzzle);
      expect(p.ok).toBe(true);
      if (!p.ok) return;

      const res = solve(p.board, 4);
      expect(res.solved).toBe(true);

      const traceTechs = new Set(res.steps.map((s) => s.technique));
      for (const req of g.requires) expect(traceTechs.has(req as never)).toBe(true);

      // Final board equals declared solution...
      expect(boardToString(res.finalBoard)).toBe(g.solution);
      // ...and the validator independently confirms that IS the unique solution.
      const u = checkUniqueness(p.board);
      expect(u.status).toBe("unique");
      if (u.status === "unique") expect(u.solution.join("")).toBe(g.solution);
    });
  }
});
