import { describe, it, expect } from "vitest";
import { parsePuzzle, boardToString } from "../src/board.js";
import { checkUniqueness } from "../src/tools/unique-validator.js";
import { EASY, LOCKED } from "./fixtures/golden.js";

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
