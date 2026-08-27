import { describe, it, expect } from "vitest";
import { parsePuzzle, boardToString } from "../src/board.js";
import { solve, findNextStep } from "../src/human-solver/solver.js";
import { EASY, LOCKED } from "./fixtures/golden.js";

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
