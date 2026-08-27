import { describe, it, expect } from "vitest";
import { parsePuzzle } from "../src/board.js";
import { getCandidates, getAllCandidates } from "../src/candidate-engine.js";
import { EASY } from "./fixtures/golden.js";

const board = () => {
  const p = parsePuzzle(EASY.puzzle);
  if (!p.ok) throw new Error("fixture parse");
  return p.board;
};

describe("Candidate Engine — single logical source (§17-§19)", () => {
  it("filled cells have no candidates", () => {
    const b = board();
    for (let i = 0; i < 81; i++) if (b[i]!.value != null) expect(getCandidates(b, i).size).toBe(0);
  });

  it("candidates exclude peer values", () => {
    const b = board();
    // cell 2 (row0 col2) empty in EASY. Row0 givens: 5,3 ; box: 5,3,6,9,8 ...
    const c = getCandidates(b, 2);
    expect(c.has(5)).toBe(false);
    expect(c.has(3)).toBe(false);
    for (const d of c) expect(d).toBeGreaterThanOrEqual(1);
  });

  it("IGNORES userNotes entirely (§19)", () => {
    const b = board();
    // Put a bogus note on an empty cell; candidates must be unchanged.
    const empty = b.findIndex((c) => c.value == null);
    const before = [...getCandidates(b, empty)];
    b[empty]!.userNotes = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const after = [...getCandidates(b, empty)];
    expect(after).toEqual(before);
  });

  it("getAllCandidates only maps empty cells", () => {
    const b = board();
    const all = getAllCandidates(b);
    const emptyCount = b.filter((c) => c.value == null).length;
    expect(all.size).toBe(emptyCount);
  });
});
