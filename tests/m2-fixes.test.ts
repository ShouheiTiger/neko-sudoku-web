import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  useGameStore,
  persistCurrentGame,
  __setNowForTests,
  __resetNowForTests,
  __setVisibilityForTests,
  __resetVisibilityForTests,
} from "../src/stores/gameStore.js";
import { loadActiveGame } from "../src/storage/gameStorage.js";
import { elapsedMs } from "../src/lib/timer.js";
import { DEV_PUZZLES } from "../src/data/dev-puzzles.js";

const SOLUTIONS: Record<string, string> = Object.fromEntries(
  DEV_PUZZLES.map((p) => [p.id, p.solution]),
);

let clock = 0;
const S = () => useGameStore.getState();

function reset() {
  window.localStorage.clear();
  clock = 1000;
  __setNowForTests(() => clock);
  __setVisibilityForTests(() => "visible");
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
  const puzzleId = S().game!.puzzleId;
  const solution = SOLUTIONS[puzzleId]!;
  const board0 = S().game!.board;
  for (let i = 0; i < 81; i++) {
    if (board0[i]!.given) continue;
    S().selectCell(i);
    S().enterDigit(Number(solution[i]));
  }
}

describe("M2 FIX-1: completed activeGame cleanup (Gate Medium-1)", () => {
  beforeEach(reset);
  afterEach(() => {
    __resetNowForTests();
    __resetVisibilityForTests();
  });

  it("completion → persistent activeGame is absent", () => {
    S().startNewGame(1);
    solveFully();
    expect(S().status).toBe("completed");
    expect(loadActiveGame()).toBeNull(); // FIX-1: cleared from localStorage
  });

  it("completion → in-memory game & elapsed remain for the completion page", () => {
    clock = 0;
    S().startNewGame(1);
    clock = 42000;
    solveFully();
    expect(S().game).not.toBeNull(); // kept in memory to render 🐱 + time
    expect(S().completedElapsedMs).toBe(42000);
  });

  it("completion → persistCurrentGame (pagehide/visibility) does NOT resurrect activeGame", () => {
    S().startNewGame(1);
    solveFully();
    expect(loadActiveGame()).toBeNull();
    persistCurrentGame(); // simulate pagehide/visibilitychange after completion
    expect(loadActiveGame()).toBeNull(); // still absent
  });

  it("an UNfinished game is still persisted normally (semantic preserved)", () => {
    S().startNewGame(1);
    S().setErrorMode("unchecked");
    const empty = S().game!.board.findIndex((c) => c.value == null);
    S().selectCell(empty);
    S().enterDigit(5);
    expect(loadActiveGame()).not.toBeNull(); // active (unfinished) game persists
  });
});

describe("M2 FIX-2: restore respects visibilityState (Gate Medium-2)", () => {
  beforeEach(reset);
  afterEach(() => {
    __resetNowForTests();
    __resetVisibilityForTests();
  });

  function startAndPauseAt(activeMs: number) {
    clock = 0;
    S().startNewGame(1);
    clock = activeMs;
    S().pauseForHidden(); // persist paused at `activeMs` of active time
    useGameStore.setState({ game: null, restoreAttempted: false }); // simulate JS reload
  }

  it("hidden reload keeps timer paused → background time NOT counted", () => {
    startAndPauseAt(5000); // 5s active before going to background
    __setVisibilityForTests(() => "hidden");
    clock = 200000; // long background before the hidden-tab JS context reloads
    S().restoreGame();
    // more hidden time passes, then a redundant hidden check
    clock = 260000;
    const before = elapsedMs(S().game!.timer, 260000);
    S().pauseForHidden(); // hidden→hidden should not double-accumulate
    const after = elapsedMs(S().game!.timer, 300000);
    expect(before).toBe(5000); // no background counted
    expect(after).toBe(5000); // still no background, no double accumulate
  });

  it("visible restore resumes normally (foreground refresh unchanged)", () => {
    startAndPauseAt(5000);
    __setVisibilityForTests(() => "visible");
    clock = 100000; // background gap before reload
    S().restoreGame();
    clock = 103000; // +3s foreground after reload
    expect(elapsedMs(S().game!.timer, 103000)).toBe(8000); // 5s + 3s, bg excluded
  });

  it("hidden restore then becomes visible → resumes without counting the hidden gap", () => {
    startAndPauseAt(5000);
    __setVisibilityForTests(() => "hidden");
    clock = 200000;
    S().restoreGame(); // stays paused
    // user brings the tab to foreground
    __setVisibilityForTests(() => "visible");
    clock = 200000;
    S().resumeFromVisible();
    clock = 204000; // +4s active
    expect(elapsedMs(S().game!.timer, 204000)).toBe(9000); // 5s + 4s
  });

  it("visible→visible restore does not double resume", () => {
    startAndPauseAt(5000);
    __setVisibilityForTests(() => "visible");
    clock = 10000;
    S().restoreGame(); // resumes at 10000
    S().resumeFromVisible(); // no-op (already running)
    clock = 15000;
    expect(elapsedMs(S().game!.timer, 15000)).toBe(10000); // 5s + 5s, not doubled
  });
});
