// §65/§66/§67/§68 Production runtime tests: loader selection + recent-avoidance, bank errors,
// production restore, and production completion — all with injected fixtures (no real chunks).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  __setBankImporterForTests,
  loadLevel,
  selectLoaded,
  findPuzzleById,
  isLevelLoaded,
  type Level,
} from "../src/data/bank/loader.js";
import {
  loadRecentPuzzleIds,
  clearRecentPuzzleIds,
  RECENT_PUZZLE_LIMIT,
  loadActiveGame,
  RECENT_PUZZLE_IDS_KEY,
} from "../src/storage/gameStorage.js";
import {
  useGameStore,
  __setPuzzleSourceForTests,
  __setNowForTests,
  __resetNowForTests,
} from "../src/stores/gameStore.js";
import { DEV_PUZZLES } from "../src/data/dev-puzzles.js";
import { BANK_VERSION } from "../src/data/bank/format.js";

// Build a small VALID production-shaped level fixture from real dev puzzles (they are unique,
// solvable, and structurally valid) but relabeled with production ids so the loader accepts them.
function fixtureLevel(level: Level, n: number) {
  const src = DEV_PUZZLES.filter((p) => p.difficulty === level);
  const puzzles = Array.from({ length: n }, (_, i) => {
    const base = src[i % src.length]!;
    return {
      id: `v1-l${level}-${String(i + 1).padStart(4, "0")}`,
      bankVersion: BANK_VERSION,
      difficulty: level,
      puzzle: base.puzzle,
      solution: base.solution,
      analysis: {
        maxRequiredTechnique: "naked-single",
        totalSteps: 1,
        nonSingleSteps: 0,
        candidateEliminations: 0,
      },
    };
  });
  return { bankVersion: BANK_VERSION, difficulty: level, puzzles };
}

const S = () => useGameStore.getState();
let clock = 0;

function resetStore() {
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
    bankError: null,
  });
}

describe("Production loader selection & recent-avoidance (§65/§26)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Deterministic importer: 5 puzzles for L1.
    __setBankImporterForTests((lvl) => Promise.resolve(fixtureLevel(lvl, lvl === 1 ? 5 : 3)));
  });
  afterEach(() => __setBankImporterForTests(null));

  it("loadLevel validates and only returns the requested level", async () => {
    const res = await loadLevel(1);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.level.difficulty).toBe(1);
      expect(res.level.puzzles.every((p) => p.id.startsWith("v1-l1-"))).toBe(true);
    }
  });

  it("selectLoaded excludes recent ids when alternatives exist and records recents (bounded)", async () => {
    await loadLevel(1);
    const seen: string[] = [];
    // 5 unique puzzles → 5 fresh selections should be distinct.
    for (let i = 0; i < 5; i++) seen.push(selectLoaded(1, () => 0)!.id); // rnd=0 → pick first fresh
    expect(new Set(seen).size).toBe(5);
    // recent list is bounded.
    expect(loadRecentPuzzleIds().length).toBeLessThanOrEqual(RECENT_PUZZLE_LIMIT);
  });

  it("relaxes oldest-first when ALL candidates are recent (never blocks)", async () => {
    await loadLevel(1);
    // Exhaust all 5 so every id is recent.
    for (let i = 0; i < 5; i++) selectLoaded(1, () => 0);
    const again = selectLoaded(1, () => 0);
    expect(again).not.toBeNull(); // still returns a puzzle
  });

  it("findPuzzleById resolves within the correct level; unknown id → null", async () => {
    const found = await findPuzzleById("v1-l1-0002");
    expect(found?.id).toBe("v1-l1-0002");
    expect(await findPuzzleById("v1-l9-9999")).toBeNull();
    expect(await findPuzzleById("garbage")).toBeNull();
  });

  it("recent list survives a corrupt entry (falls back to empty, never throws)", async () => {
    window.localStorage.setItem(RECENT_PUZZLE_IDS_KEY, "{not json");
    expect(loadRecentPuzzleIds()).toEqual([]);
    clearRecentPuzzleIds();
  });
});

describe("Production bank load errors (§68/§45)", () => {
  afterEach(() => __setBankImporterForTests(null));

  it("network error → typed failure, no crash", async () => {
    __setBankImporterForTests(() => Promise.reject(new Error("offline")));
    const res = await loadLevel(2);
    expect(res).toEqual({ ok: false, reason: "network" });
  });

  it("invalid JSON (null) → invalid-json", async () => {
    __setBankImporterForTests(() => Promise.resolve(null));
    expect((await loadLevel(2)).ok).toBe(false);
  });

  it("wrong bankVersion → wrong-bank-version", async () => {
    __setBankImporterForTests(() =>
      Promise.resolve({ bankVersion: "v99", difficulty: 2, puzzles: [] }),
    );
    const res = await loadLevel(2);
    expect(res).toEqual({ ok: false, reason: "wrong-bank-version" });
  });

  it("schema mismatch → invalid-schema", async () => {
    __setBankImporterForTests(() => Promise.resolve({ foo: "bar" }));
    const res = await loadLevel(2);
    expect(res).toEqual({ ok: false, reason: "invalid-schema" });
  });

  it("empty level → empty", async () => {
    __setBankImporterForTests(() =>
      Promise.resolve({ bankVersion: BANK_VERSION, difficulty: 2, puzzles: [] }),
    );
    const res = await loadLevel(2);
    expect(res).toEqual({ ok: false, reason: "empty" });
  });
});

describe("Store production integration (§45/§66/§67)", () => {
  beforeEach(() => {
    resetStore();
    __setBankImporterForTests((lvl) => Promise.resolve(fixtureLevel(lvl, 3)));
    // Route the store's sync source through the loader cache (default behaviour).
    __setPuzzleSourceForTests(null);
  });
  afterEach(() => {
    __setBankImporterForTests(null);
    __resetNowForTests();
  });

  it("startNewGame WITHOUT prepareLevel surfaces a non-crashing bankError (no activeGame)", () => {
    S().startNewGame(1);
    expect(S().game).toBeNull();
    expect(S().bankError).not.toBeNull();
    expect(loadActiveGame()).toBeNull(); // §45 no corrupt activeGame
  });

  it("prepareLevel then startNewGame serves a PRODUCTION puzzle with snapshot", async () => {
    const err = await S().prepareLevel(1);
    expect(err).toBeNull();
    S().startNewGame(1);
    expect(S().bankError).toBeNull();
    expect(S().status).toBe("playing");
    expect(S().game!.puzzleId).toMatch(/^v1-l1-\d{4}$/);
    expect(S().game!.puzzleSnapshot?.bankVersion).toBe(BANK_VERSION);
  });

  it("prepareLevel failure yields a reason and no game (§45)", async () => {
    __setBankImporterForTests(() => Promise.reject(new Error("offline")));
    // reset loader cache by re-setting importer already clears cache
    const err = await S().prepareLevel(3);
    expect(err).toBe("network");
    S().startNewGame(3);
    expect(S().game).toBeNull();
  });

  it("production restore: reload keeps same puzzleId/board and solution validation works (§66)", async () => {
    await S().prepareLevel(1);
    S().startNewGame(1);
    const id = S().game!.gameId;
    const puzzleId = S().game!.puzzleId;
    const snapshot = S().game!.puzzleSnapshot!;
    // simulate reload
    useGameStore.setState({ game: null, status: "idle", restoreAttempted: false });
    const ok = S().restoreGame();
    expect(ok).toBe(true);
    expect(S().game!.gameId).toBe(id);
    expect(S().game!.puzzleId).toBe(puzzleId);
    // gentle validation uses the snapshot solution (not the dev pool, id is production).
    const firstEmpty = S().game!.board.findIndex((c) => !c.given);
    S().selectCell(firstEmpty);
    S().enterDigit(((Number(snapshot.solution[firstEmpty]) % 9) + 1)); // deliberately wrong-ish
    // A wrong digit in gentle mode must NOT be committed.
    if (Number(snapshot.solution[firstEmpty]) !== ((Number(snapshot.solution[firstEmpty]) % 9) + 1)) {
      expect(S().gentleError).not.toBeNull();
    }
  });

  it("production completion writes history once, clears activeGame, freezes elapsed (§67)", async () => {
    await S().prepareLevel(1);
    S().startNewGame(1);
    const solution = S().game!.puzzleSnapshot!.solution;
    const gameId = S().game!.gameId;
    clock = 20_000;
    const board0 = S().game!.board;
    for (let i = 0; i < 81; i++) {
      if (board0[i]!.given) continue;
      S().selectCell(i);
      S().enterDigit(Number(solution[i]));
    }
    expect(S().status).toBe("completed");
    expect(S().completedElapsedMs).toBe(20_000);
    expect(loadActiveGame()).toBeNull();
    // history exactly one, no forbidden fields.
    const rawHist = JSON.parse(window.localStorage.getItem("nekoSudoku.history")!);
    expect(rawHist.records.length).toBe(1);
    expect(rawHist.records[0].gameId).toBe(gameId);
    expect(rawHist.records[0]).not.toHaveProperty("score");
  });
});
