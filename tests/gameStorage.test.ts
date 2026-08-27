import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  saveActiveGame,
  loadActiveGame,
  clearActiveGame,
  ACTIVE_GAME_KEY,
} from "../src/storage/gameStorage.js";
import { SCHEMA_VERSION, ENGINE_VERSION, type ActiveGame } from "../src/storage/schemas.js";
import { parsePuzzle } from "../src/board.js";
import { DEV_PUZZLES } from "../src/data/dev-puzzles.js";

const sample = DEV_PUZZLES[0]!;

function makeGame(): ActiveGame {
  const parsed = parsePuzzle(sample.puzzle);
  if (!parsed.ok) throw new Error("fixture parse");
  const now = Date.now();
  return {
    schemaVersion: SCHEMA_VERSION,
    gameId: "g-test-1",
    puzzleId: sample.id,
    difficulty: sample.difficulty,
    board: parsed.board,
    selectedCell: null,
    noteMode: false,
    undoStack: [],
    hintCount: 0,
    directHintCount: 0,
    timer: { activeStartedAt: now, accumulatedActiveMs: 0 },
    createdAt: now,
    updatedAt: now,
    engineVersion: ENGINE_VERSION,
  };
}

describe("gameStorage (§20-§23, §31)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("save + restore a valid game round-trips exactly", () => {
    const g = makeGame();
    saveActiveGame(g);
    const back = loadActiveGame();
    expect(back).not.toBeNull();
    expect(back!.gameId).toBe(g.gameId);
    expect(back!.board).toEqual(g.board);
    expect(back!.difficulty).toBe(g.difficulty);
  });

  it("stored envelope contains schemaVersion", () => {
    saveActiveGame(makeGame());
    const raw = JSON.parse(window.localStorage.getItem(ACTIVE_GAME_KEY)!);
    expect(raw.schemaVersion).toBe(SCHEMA_VERSION);
    expect(typeof raw.savedAt).toBe("number");
    expect(raw.data).toBeDefined();
  });

  it("invalid JSON -> null and entry dropped, no throw", () => {
    window.localStorage.setItem(ACTIVE_GAME_KEY, "{not json");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(loadActiveGame()).toBeNull();
    expect(window.localStorage.getItem(ACTIVE_GAME_KEY)).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it("wrong schemaVersion -> null and dropped", () => {
    const g = makeGame();
    const badEnvelope = { schemaVersion: 999, savedAt: Date.now(), data: g };
    window.localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(badEnvelope));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(loadActiveGame()).toBeNull();
    expect(window.localStorage.getItem(ACTIVE_GAME_KEY)).toBeNull();
  });

  it("in-progress conflicting board still restores (§37.2 unchecked mode, §2.5 recoverable)", () => {
    const g = makeGame();
    // A player may legitimately create a duplicate mid-game under unchecked mode.
    g.board[0] = { given: false, value: 5, userNotes: [] };
    g.board[1] = { given: false, value: 5, userNotes: [] };
    const envelope = { schemaVersion: SCHEMA_VERSION, savedAt: Date.now(), data: g };
    window.localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(envelope));
    const back = loadActiveGame();
    expect(back).not.toBeNull();
    expect(back!.board[0]!.value).toBe(5);
    expect(back!.board[1]!.value).toBe(5);
  });

  it("structurally invalid board (wrong length) -> null and dropped (§22 Zod)", () => {
    const g = makeGame() as unknown as { board: unknown[] };
    g.board = g.board.slice(0, 80); // 80 cells, violates .length(81)
    const envelope = { schemaVersion: SCHEMA_VERSION, savedAt: Date.now(), data: g };
    window.localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(envelope));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(loadActiveGame()).toBeNull();
    expect(window.localStorage.getItem(ACTIVE_GAME_KEY)).toBeNull();
  });

  it("out-of-range cell value -> null and dropped (§22 Zod)", () => {
    const g = makeGame();
    g.board[0] = { given: false, value: 42, userNotes: [] };
    const envelope = { schemaVersion: SCHEMA_VERSION, savedAt: Date.now(), data: g };
    window.localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(envelope));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(loadActiveGame()).toBeNull();
  });

  it("unknown puzzleId -> null and dropped (§23)", () => {
    const g = makeGame();
    g.puzzleId = "does-not-exist";
    const envelope = { schemaVersion: SCHEMA_VERSION, savedAt: Date.now(), data: g };
    window.localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(envelope));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(loadActiveGame()).toBeNull();
  });

  it("missing schemaVersion field -> null (bare data schema also enforced)", () => {
    const g = makeGame() as Record<string, unknown>;
    delete g.schemaVersion;
    window.localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(g));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(loadActiveGame()).toBeNull();
  });

  it("clearActiveGame removes the entry", () => {
    saveActiveGame(makeGame());
    clearActiveGame();
    expect(window.localStorage.getItem(ACTIVE_GAME_KEY)).toBeNull();
  });
});
