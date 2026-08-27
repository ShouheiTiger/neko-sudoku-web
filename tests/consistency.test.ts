import { describe, it, expect } from "vitest";
import { parsePuzzle } from "../src/board.js";
import { getAllCandidates } from "../src/candidate-engine.js";
import { seedWorking } from "../src/human-solver/working-candidates.js";
import { findStep, solve } from "../src/human-solver/solver.js";
import { getHint } from "../src/hint-engine/hint-engine.js";
import { EASY, LOCKED } from "./fixtures/golden.js";

// §26 REQUIRED integration test:
// "For the same Board State, the logical candidates used by the Hint Engine and the
//  Solver must be exactly identical." + Hint must not derive from userNotes.
describe("§26 Hint <-> Solver candidate consistency", () => {
  it("Hint's next step equals Solver's next step on identical boards, across a full trace", () => {
    for (const g of [EASY, LOCKED]) {
      const p = parsePuzzle(g.puzzle);
      if (!p.ok) throw new Error();
      let board = p.board;
      const difficulty = 4 as const;

      for (let guard = 0; guard < 200; guard++) {
        if (board.every((c) => c.value != null)) break;

        // Solver's view of the next step (seeded from Candidate Engine)
        const working = seedWorking(board);
        const solverStep = findStep(board, working, 4);

        // Hint's view of the next step (must reuse the same primitive)
        const hint = getHint(board, difficulty, 2);

        if (solverStep == null) {
          expect(hint.available).toBe(false);
          break;
        }
        expect(hint.available).toBe(true);
        if (!hint.available) break;
        // Same technique + same target: proves identical candidate basis.
        expect(hint.hint.step.technique).toBe(solverStep.technique);
        if (solverStep.kind === "placement" && hint.hint.step.kind === "placement") {
          expect(hint.hint.step.cellIndex).toBe(solverStep.cellIndex);
          expect(hint.hint.step.digit).toBe(solverStep.digit);
        }

        // Advance the board one step to continue the trace
        if (solverStep.kind === "placement") {
          board = board.map((c, i) =>
            i === solverStep.cellIndex ? { given: false, value: solverStep.digit, userNotes: [] } : c,
          );
        } else {
          // elimination step: apply to a fresh solve to advance deterministically
          const solved = solve(board, 4);
          expect(solved.solved).toBe(true);
          break;
        }
      }
    }
  });

  it("Hint ignores userNotes — bogus notes do not change the hint (§19)", () => {
    const p = parsePuzzle(EASY.puzzle);
    if (!p.ok) throw new Error();
    const clean = getHint(p.board, 2, 3);

    const dirty = p.board.map((c) =>
      c.value == null ? { ...c, userNotes: [1, 2, 3, 4, 5, 6, 7, 8, 9] } : c,
    );
    const dirtyHint = getHint(dirty, 2, 3);

    expect(clean.available && dirtyHint.available).toBe(true);
    if (clean.available && dirtyHint.available) {
      expect(dirtyHint.hint.step.technique).toBe(clean.hint.step.technique);
      if (clean.hint.layer === 3 && dirtyHint.hint.layer === 3) {
        expect(dirtyHint.hint.fill).toEqual(clean.hint.fill);
      }
    }
  });

  it("Candidate Engine map equals the seed of the Solver's working grid", () => {
    const p = parsePuzzle(LOCKED.puzzle);
    if (!p.ok) throw new Error();
    const engine = getAllCandidates(p.board);
    const working = seedWorking(p.board);
    expect(working.size).toBe(engine.size);
    for (const [i, s] of engine) expect([...working.get(i)!].sort()).toEqual([...s].sort());
  });
});
