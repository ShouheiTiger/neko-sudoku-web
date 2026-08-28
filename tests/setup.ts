import "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { __setPuzzleSourceForTests } from "../src/stores/gameStore.js";
import { puzzlesForDifficulty } from "../src/data/dev-puzzles.js";

// Default test puzzle source: deterministic dev-pool selection (§25 dev fixtures allowed in
// tests). Individual tests that exercise the PRODUCTION bank/loader override this via
// __setPuzzleSourceForTests(...) and reset it in their own afterEach. Keeping the dev pool as
// the default lets the large M2/M3 store suites keep calling startNewGame() synchronously.
let devCursor = 0;
beforeEach(() => {
  devCursor = 0;
  __setPuzzleSourceForTests((difficulty) => {
    const pool = puzzlesForDifficulty(difficulty as 1 | 2 | 3 | 4);
    if (pool.length === 0) return null;
    const p = pool[devCursor++ % pool.length]!;
    // Dev games have no snapshot in production; but tests need gentle-validation to work, so we
    // provide the dev solution via the snapshot channel (the store also falls back to dev pool).
    return { id: p.id, puzzle: p.puzzle, solution: p.solution, bankVersion: "dev" };
  });
});

// Ensure DOM + localStorage are reset between tests.
afterEach(() => {
  cleanup();
  __setPuzzleSourceForTests(null);
  try {
    window.localStorage.clear();
  } catch {
    /* localStorage may be unavailable in some environments */
  }
});
