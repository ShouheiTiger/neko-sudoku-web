import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  useGameStore,
  __setNowForTests,
  __resetNowForTests,
} from "../src/stores/gameStore.js";
import { loadActiveGame, loadHistory } from "../src/storage/gameStorage.js";
import { DEV_PUZZLES } from "../src/data/dev-puzzles.js";

const SOLUTIONS: Record<string, string> = Object.fromEntries(
  DEV_PUZZLES.map((p) => [p.id, p.solution]),
);

let clock = 0;
const S = () => useGameStore.getState();

function reset() {
  window.localStorage.clear();
  clock = 0;
  __setNowForTests(() => clock);
  useGameStore.setState({
    status: "idle",
    game: null,
    restoreAttempted: false,
    errorMode: "gentle",
    gentleError: null,
    hint: null,
    completedElapsedMs: null,
  });
}

function solveFully() {
  const solution = SOLUTIONS[S().game!.puzzleId]!;
  const board0 = S().game!.board;
  for (let i = 0; i < 81; i++) {
    if (board0[i]!.given) continue;
    S().selectCell(i);
    S().enterDigit(Number(solution[i]));
  }
}

describe("M3 completion integration (§22, §38)", () => {
  beforeEach(reset);
  afterEach(() => __resetNowForTests());

  it("completion writes exactly one history record and clears activeGame", () => {
    S().startNewGame(1);
    const gameId = S().game!.gameId;
    clock = 30_000;
    solveFully();

    expect(S().status).toBe("completed");
    expect(loadActiveGame()).toBeNull(); // cleared (§22 / FIX-1)
    const h = loadHistory();
    expect(h.length).toBe(1);
    expect(h[0]!.gameId).toBe(gameId);
    expect(h[0]!.difficulty).toBe(1);
    expect(h[0]!.elapsedMs).toBe(30_000);
  });

  it("repeated completion commits do NOT duplicate the history record", () => {
    S().startNewGame(1);
    solveFully();
    expect(loadHistory().length).toBe(1);

    // Simulate a repeated completion handler / rerender re-committing the same finished board.
    const g = S().game!;
    // Re-run commit path by re-selecting + re-entering the last solved value (idempotent set).
    const lastIdx = g.board.findIndex((c) => !c.given);
    S().selectCell(lastIdx);
    S().enterDigit(g.board[lastIdx]!.value!); // same correct value → still completed
    expect(loadHistory().length).toBe(1); // still exactly one (dedupe by gameId)
    expect(loadActiveGame()).toBeNull();
  });

  it("two different completed games produce two records", () => {
    S().startNewGame(1);
    const id1 = S().game!.gameId;
    solveFully();
    S().startNewGame(2);
    const id2 = S().game!.gameId;
    solveFully();
    const ids = loadHistory().map((r) => r.gameId).sort();
    expect(ids).toEqual([id1, id2].sort());
  });
});
