import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  useGameStore,
  __setNowForTests,
  __resetNowForTests,
} from "../src/stores/gameStore.js";
import { loadActiveGame, loadHistory, HISTORY_KEY } from "../src/storage/gameStorage.js";
import { DEV_PUZZLES } from "../src/data/dev-puzzles.js";

const SOLUTIONS: Record<string, string> = Object.fromEntries(
  DEV_PUZZLES.map((p) => [p.id, p.solution]),
);

let clock = 0;
const S = () => useGameStore.getState();

function reset() {
  window.localStorage.clear();
  vi.restoreAllMocks();
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

/** Solve the current game fully with correct solution digits (real commit path). */
function solveFully() {
  const solution = SOLUTIONS[S().game!.puzzleId]!;
  const board0 = S().game!.board;
  for (let i = 0; i < 81; i++) {
    if (board0[i]!.given) continue;
    S().selectCell(i);
    S().enterDigit(Number(solution[i]));
  }
}

describe("M3 FIX M-1: History write-failure completion semantics", () => {
  beforeEach(reset);
  afterEach(() => __resetNowForTests());

  // A. history setItem throws → completion does not crash → history absent → activeGame remains
  it("A: history quota failure keeps a recoverable activeGame and does not crash", () => {
    S().startNewGame(1);
    const gameId = S().game!.gameId;

    // Make ONLY history writes fail; activeGame saves still work.
    const real = Storage.prototype.setItem;
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key: string, value: string) {
        if (key === HISTORY_KEY) throw new DOMException("quota", "QuotaExceededError");
        return real.call(this, key, value);
      });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    clock = 30_000;
    expect(() => solveFully()).not.toThrow(); // completion UI must not crash (§32)

    expect(S().status).toBe("completed");
    expect(S().completedElapsedMs).toBe(30_000); // page can still show elapsed
    // history was NOT written…
    spy.mockRestore();
    expect(loadHistory().length).toBe(0);
    // …and the completed activeGame is RETAINED for retry (not lost).
    const retained = loadActiveGame();
    expect(retained).not.toBeNull();
    expect(retained!.gameId).toBe(gameId);
  });

  // B. reload/restore of the retained completed game → retry succeeds → exactly one → cleared
  it("B: restoring the retained completed game retries history successfully then clears", () => {
    S().startNewGame(1);
    const gameId = S().game!.gameId;
    const real = Storage.prototype.setItem;
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key: string, value: string) {
        if (key === HISTORY_KEY) throw new DOMException("quota", "QuotaExceededError");
        return real.call(this, key, value);
      });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    clock = 12_000;
    solveFully();
    expect(loadActiveGame()).not.toBeNull(); // retained

    // Storage recovers; simulate a fresh page load (wipe in-memory store) then restore.
    spy.mockRestore();
    useGameStore.setState({ game: null, status: "idle", restoreAttempted: false });
    clock = 99_000; // time passes before reload — must NOT change frozen elapsed
    const ok = S().restoreGame();

    expect(ok).toBe(true);
    expect(S().status).toBe("completed");
    const h = loadHistory();
    expect(h.length).toBe(1); // exactly one
    expect(h[0]!.gameId).toBe(gameId);
    expect(h[0]!.elapsedMs).toBe(12_000); // frozen elapsed preserved, not inflated
    expect(loadActiveGame()).toBeNull(); // now cleared
  });

  // C. history already contains same gameId → duplicate → activeGame can safely clear, no 2nd row
  it("C: duplicate gameId is treated as already-saved; activeGame clears, no second row", () => {
    S().startNewGame(1);
    solveFully();
    expect(loadHistory().length).toBe(1);
    const firstId = loadHistory()[0]!.gameId;
    expect(loadActiveGame()).toBeNull();

    // Re-commit the same finished board (simulate a retry where history already has it).
    const g = S().game!;
    const lastIdx = g.board.findIndex((c) => !c.given);
    S().selectCell(lastIdx);
    S().enterDigit(g.board[lastIdx]!.value!); // same correct value → duplicate append
    expect(loadHistory().length).toBe(1); // still one
    expect(loadHistory()[0]!.gameId).toBe(firstId);
    expect(loadActiveGame()).toBeNull(); // stays cleared
  });

  // D. normal successful completion → history one → activeGame absent
  it("D: normal completion writes exactly one record and clears activeGame", () => {
    S().startNewGame(2);
    const gameId = S().game!.gameId;
    clock = 45_000;
    solveFully();
    expect(S().status).toBe("completed");
    const h = loadHistory();
    expect(h.length).toBe(1);
    expect(h[0]!.gameId).toBe(gameId);
    expect(loadActiveGame()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// M3 FIX M-2: --color-muted must meet WCAG AA (>=4.5:1) on both surfaces.
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function relLum(hex: string): number {
  const to = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * to(1) + 0.7152 * to(3) + 0.0722 * to(5);
}
function contrast(fg: string, bg: string): number {
  const a = relLum(fg);
  const b = relLum(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}
function readVar(css: string, name: string): string {
  const m = css.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`var ${name} not found`);
  return m[1]!.toLowerCase();
}

describe("M3 FIX M-2: WCAG AA contrast for --color-muted", () => {
  const cssPath = resolve(process.cwd(), "src/app/styles.css");
  const css = readFileSync(cssPath, "utf8");
  const muted = readVar(css, "--color-muted");
  const bg = readVar(css, "--color-bg"); // #fbf7ef
  const surface = readVar(css, "--color-surface"); // #ffffff

  it("resolves the expected token surfaces", () => {
    expect(bg).toBe("#fbf7ef");
    expect(surface).toBe("#ffffff");
  });

  it("muted text >= 4.5:1 on page background (#fbf7ef)", () => {
    expect(contrast(muted, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("muted text >= 4.5:1 on card surface (#ffffff)", () => {
    expect(contrast(muted, surface)).toBeGreaterThanOrEqual(4.5);
  });
});
