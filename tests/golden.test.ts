import { describe, it, expect } from "vitest";
import { parsePuzzle, boardToString } from "../src/board.js";
import { checkUniqueness } from "../src/tools/unique-validator.js";
import type { BoardState } from "../src/types.js";
import { EASY, LOCKED } from "./fixtures/golden.js";

const emptyBoard = (): BoardState =>
  Array.from({ length: 81 }, () => ({ given: false, value: null as number | null, userNotes: [] }));

describe("golden fixtures are valid & uniquely solvable (§15.1, §16)", () => {
  for (const g of [EASY, LOCKED]) {
    it(`${g.id}: parses, unique solution matches declared solution`, () => {
      const parsed = parsePuzzle(g.puzzle);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      const u = checkUniqueness(parsed.board);
      expect(u.status).toBe("unique");
      if (u.status !== "unique") return;
      expect(u.solution.join("")).toBe(g.solution);
    });
  }

  it("empty puzzle has multiple solutions", () => {
    const parsed = parsePuzzle("0".repeat(81));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(checkUniqueness(parsed.board).status).toBe("multiple");
  });

  it("boardToString round-trips givens", () => {
    const parsed = parsePuzzle(EASY.puzzle);
    if (!parsed.ok) throw new Error("parse");
    expect(boardToString(parsed.board)).toBe(EASY.puzzle);
  });
});

// Low-2 + gap #3 (Gate Review): validator edge-case coverage that was previously absent.
describe("Unique Validator edge cases (§15.1, E13)", () => {
  it('no-solution: a legal (conflict-free) board with zero solutions -> "no-solution"', () => {
    // Construct a board with NO duplicate values but where an empty cell has no
    // possible candidate. Row 0: cols 0..7 = 1..8 ; then col 8 of some other row is 9,
    // and box of r0c8 also forces 9 out -> r0c8 can't be filled, yet no givens conflict.
    const b = emptyBoard();
    // Row 0, columns 0..7 -> 1..8 (r0c8 empty)
    for (let c = 0; c < 8; c++) b[c] = { given: true, value: c + 1, userNotes: [] };
    // Force 9 to be impossible at r0c8: put 9 somewhere in column 8 (r3c8),
    // which shares column with r0c8. No duplicates introduced.
    b[3 * 9 + 8] = { given: true, value: 9, userNotes: [] };
    // Sanity: this board itself has no conflicts (validator must not report invalid-givens).
    const res = checkUniqueness(b);
    expect(res.status).toBe("no-solution");
  });

  it('invalid-givens: a board built directly with a row duplicate -> "invalid-givens" (Medium-1)', () => {
    // This is the Medium-1 regression: a caller (e.g. generator) builds BoardState
    // directly, bypassing parsePuzzle. The validator MUST reject it, not report unique.
    const b = emptyBoard();
    b[0] = { given: true, value: 5, userNotes: [] };
    b[1] = { given: true, value: 5, userNotes: [] }; // duplicate 5 in row 0
    const res = checkUniqueness(b);
    expect(res.status).toBe("invalid-givens");
    if (res.status === "invalid-givens") {
      expect(res.conflicts).toContain(0);
      expect(res.conflicts).toContain(1);
    }
  });

  it("invalid-givens does NOT count as a unique solution (hasUniqueSolution stays false)", async () => {
    const { hasUniqueSolution } = await import("../src/tools/unique-validator.js");
    const b = emptyBoard();
    b[0] = { given: true, value: 7, userNotes: [] };
    b[9] = { given: true, value: 7, userNotes: [] }; // duplicate 7 in column 0
    expect(hasUniqueSolution(b)).toBe(false);
  });
});
