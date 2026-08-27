import { describe, it, expect } from "vitest";
import { parsePuzzle } from "../src/board.js";
import { getAllCandidates } from "../src/candidate-engine.js";
import {
  nakedSingle,
  hiddenSingle,
  pointing,
  boxLineReduction,
  nakedPair,
  hiddenPair,
  nakedTriple,
} from "../src/human-solver/techniques.js";
import { solve } from "../src/human-solver/solver.js";
import { LOCKED } from "./fixtures/golden.js";

function boardFrom(puzzle: string) {
  const p = parsePuzzle(puzzle);
  if (!p.ok) throw new Error("parse: " + p.reason);
  return p.board;
}

describe("Individual L1-L4 technique finders (§11)", () => {
  it("naked-single fires when a cell has exactly one candidate", () => {
    // Row 0 has 1..8 given; the last empty cell must be 9.
    const b = boardFrom("123456780" + "0".repeat(72));
    const step = nakedSingle(b, getAllCandidates(b));
    expect(step?.technique).toBe("naked-single");
    if (step?.kind === "placement") {
      expect(step.cellIndex).toBe(8);
      expect(step.digit).toBe(9);
    }
  });

  it("pointing technique participates in solving LOCKED (integration)", () => {
    // The LOCKED fixture is proven (difficulty test) to need pointing-pair.
    const b = boardFrom(LOCKED.puzzle);
    const res = solve(b, 4);
    expect(res.solved).toBe(true);
    expect(res.steps.some((s) => s.kind === "elimination")).toBe(true);
  });

  it("all finders return null (never throw) when nothing applies (empty board)", () => {
    const b = boardFrom("0".repeat(81));
    const cands = getAllCandidates(b);
    expect(nakedSingle(b, cands)).toBeNull();
    expect(hiddenSingle(b, cands)).toBeNull();
    expect(pointing(b, cands)).toBeNull();
    expect(boxLineReduction(b, cands)).toBeNull();
    expect(nakedPair(b, cands)).toBeNull();
    expect(hiddenPair(b, cands)).toBeNull();
    expect(nakedTriple(b, cands)).toBeNull();
  });
});
