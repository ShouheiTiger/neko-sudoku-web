// §47 Corrupted-storage matrix + §46 write-failure regression. Every persisted key must
// degrade gracefully: no throw, no white screen, no corrupt activeGame. History write-failure
// retry (M-1) must not regress.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadSettings,
  loadHistory,
  loadActiveGame,
  loadRecentPuzzleIds,
  pushRecentPuzzleId,
  appendHistoryOnce,
  saveActiveGame,
  saveSettings,
  ACTIVE_GAME_KEY,
  SETTINGS_KEY,
  HISTORY_KEY,
  RECENT_PUZZLE_IDS_KEY,
} from "../src/storage/gameStorage.js";

const KEYS = {
  settings: SETTINGS_KEY,
  activeGame: ACTIVE_GAME_KEY,
  history: HISTORY_KEY,
  recent: RECENT_PUZZLE_IDS_KEY,
};

function silenceWarn() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
}

describe("§47 corrupted-storage matrix", () => {
  beforeEach(() => {
    window.localStorage.clear();
    silenceWarn();
  });
  afterEach(() => vi.restoreAllMocks());

  const corruptValues = [
    ["invalid JSON", "{not-json"],
    ["wrong schemaVersion", JSON.stringify({ schemaVersion: 999, data: {} })],
    ["wrong shape", JSON.stringify({ hello: "world" })],
    ["partial fields", JSON.stringify({ schemaVersion: 2, savedAt: 1 })],
    ["array where object expected", JSON.stringify([1, 2, 3])],
  ] as const;

  for (const [label, value] of corruptValues) {
    it(`settings survives ${label} (returns defaults, no throw)`, () => {
      window.localStorage.setItem(KEYS.settings, value);
      expect(() => loadSettings()).not.toThrow();
      const s = loadSettings();
      expect(s.errorMode).toBeDefined();
    });

    it(`activeGame survives ${label} (drops to null, no corrupt game)`, () => {
      window.localStorage.setItem(KEYS.activeGame, value);
      expect(() => loadActiveGame()).not.toThrow();
      expect(loadActiveGame()).toBeNull();
    });

    it(`history survives ${label} (empty list, no throw)`, () => {
      window.localStorage.setItem(KEYS.history, value);
      expect(() => loadHistory()).not.toThrow();
      expect(loadHistory()).toEqual([]);
    });

    it(`recentPuzzleIds survives ${label} (empty list, no throw)`, () => {
      window.localStorage.setItem(KEYS.recent, value);
      expect(() => loadRecentPuzzleIds()).not.toThrow();
      expect(loadRecentPuzzleIds()).toEqual([]);
    });
  }

  it("SecurityError on getItem is swallowed for every reader", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(() => loadSettings()).not.toThrow();
    expect(loadActiveGame()).toBeNull();
    expect(loadHistory()).toEqual([]);
    expect(loadRecentPuzzleIds()).toEqual([]);
  });

  it("SecurityError on setItem is swallowed for every writer", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(() => saveSettings({ schemaVersion: 2, errorMode: "gentle", largeText: false, tutorialSeen: false })).not.toThrow();
    expect(() => pushRecentPuzzleId("v1-l1-0001")).not.toThrow();
    expect(() =>
      saveActiveGame({
        schemaVersion: 3,
        gameId: "g",
        puzzleId: "v1-l1-0001",
        difficulty: 1,
        board: Array.from({ length: 81 }, () => ({ given: false, value: null, userNotes: [] })),
        selectedCell: null,
        noteMode: false,
        undoStack: [],
        hintCount: 0,
        directHintCount: 0,
        timer: { activeStartedAt: null, accumulatedActiveMs: 0 },
        createdAt: 0,
        updatedAt: 0,
        engineVersion: 1,
      }),
    ).not.toThrow();
  });

  it("QuotaExceededError on history write → 'failed' (retryable), does not throw (§46/M-1)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    const rec = {
      gameId: "g1",
      puzzleId: "v1-l1-0001",
      difficulty: 1 as const,
      completedAt: 1,
      elapsedMs: 1000,
    };
    let result: string | undefined;
    expect(() => (result = appendHistoryOnce(rec))).not.toThrow();
    expect(result).toBe("failed");
  });
});
