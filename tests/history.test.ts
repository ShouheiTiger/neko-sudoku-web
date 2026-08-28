import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadHistory,
  appendHistoryOnce,
  clearHistory,
  HISTORY_KEY,
} from "../src/storage/gameStorage.js";
import { HISTORY_LIMIT, type HistoryRecord } from "../src/storage/schemas.js";
import { formatDate, formatHistoryElapsed } from "../src/lib/format.js";

const rec = (over: Partial<HistoryRecord> = {}): HistoryRecord => ({
  gameId: "g1",
  puzzleId: "l1-1",
  difficulty: 1,
  completedAt: 1_000_000,
  elapsedMs: 90_000,
  ...over,
});

describe("M3 History storage (§20-§23, §32)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("append a completed game then load it", () => {
    expect(appendHistoryOnce(rec())).toBe("written");
    const h = loadHistory();
    expect(h.length).toBe(1);
    expect(h[0]!.gameId).toBe("g1");
  });

  it("same gameId appends only once (idempotent §22)", () => {
    expect(appendHistoryOnce(rec({ gameId: "gX" }))).toBe("written");
    expect(appendHistoryOnce(rec({ gameId: "gX" }))).toBe("duplicate");
    expect(appendHistoryOnce(rec({ gameId: "gX" }))).toBe("duplicate");
    expect(loadHistory().filter((r) => r.gameId === "gX").length).toBe(1);
  });

  it("multiple records are stored newest-first", () => {
    appendHistoryOnce(rec({ gameId: "a", completedAt: 100 }));
    appendHistoryOnce(rec({ gameId: "b", completedAt: 200 }));
    appendHistoryOnce(rec({ gameId: "c", completedAt: 300 }));
    const h = loadHistory();
    expect(h.map((r) => r.gameId)).toEqual(["c", "b", "a"]);
  });

  it("respects the storage limit", () => {
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) {
      appendHistoryOnce(rec({ gameId: `g${i}`, completedAt: i }));
    }
    expect(loadHistory().length).toBe(HISTORY_LIMIT);
  });

  it("corrupted history falls back to empty (no throw)", () => {
    window.localStorage.setItem(HISTORY_KEY, "{broken");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(loadHistory()).toEqual([]);
  });

  it("stored record NEVER contains score/hint/mistake/rank fields", () => {
    appendHistoryOnce(rec({ gameId: "g" }));
    const raw = JSON.parse(window.localStorage.getItem(HISTORY_KEY)!);
    const stored = raw.records[0];
    expect(Object.keys(stored).sort()).toEqual(
      ["completedAt", "difficulty", "elapsedMs", "gameId", "puzzleId"].sort(),
    );
    for (const forbidden of ["score", "mistakeCount", "hintCount", "directHintCount", "rank", "rating", "catGrade", "stars"]) {
      expect(stored).not.toHaveProperty(forbidden);
    }
  });

  it("Zod strips unknown extra fields so forbidden data can't sneak in", () => {
    // Even if a caller passes extras, the schema shape is enforced.
    appendHistoryOnce({ ...rec({ gameId: "z" }), ...( { score: 999, hintCount: 3 } as object) } as HistoryRecord);
    const stored = loadHistory().find((r) => r.gameId === "z")!;
    expect(stored).not.toHaveProperty("score");
    expect(stored).not.toHaveProperty("hintCount");
  });

  it("write failure (quota) does not throw and does not crash caller", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => appendHistoryOnce(rec({ gameId: "q" }))).not.toThrow();
    expect(appendHistoryOnce(rec({ gameId: "q" }))).toBe("failed");
    spy.mockRestore();
  });

  it("clearHistory empties the store", () => {
    appendHistoryOnce(rec({ gameId: "g" }));
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("M3 history formatting (§29)", () => {
  it("formats date as 年月日", () => {
    const ms = new Date(2026, 7, 27, 10, 0, 0).getTime(); // Aug = month index 7
    expect(formatDate(ms)).toBe("2026年8月27日");
  });

  it("formats elapsed without ms; minutes+seconds under an hour", () => {
    expect(formatHistoryElapsed(0)).toBe("0秒");
    expect(formatHistoryElapsed(45_000)).toBe("45秒");
    expect(formatHistoryElapsed(1_112_000)).toBe("18分32秒");
  });

  it("formats >= 1 hour as 小时分, dropping seconds", () => {
    expect(formatHistoryElapsed(3_600_000 + 8 * 60_000 + 30_000)).toBe("1小时08分");
  });
});
