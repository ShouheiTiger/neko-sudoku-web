import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  useGameStore,
  __setNowForTests,
  __resetNowForTests,
} from "../src/stores/gameStore.js";
import { loadActiveGame, loadSettings } from "../src/storage/gameStorage.js";
import { DEV_PUZZLES } from "../src/data/dev-puzzles.js";
import { getCandidates } from "../src/candidate-engine.js";
import { getHintView } from "../src/lib/hintService.js";
import { parsePuzzle } from "../src/board.js";
import { elapsedMs } from "../src/lib/timer.js";

const SOLUTIONS: Record<string, string> = Object.fromEntries(
  DEV_PUZZLES.map((p) => [p.id, p.solution]),
);

let clock = 0;
function setClock(v: number) {
  clock = v;
}

function reset() {
  window.localStorage.clear();
  clock = 1000;
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

const S = () => useGameStore.getState();
const firstEmpty = () => S().game!.board.findIndex((c) => c.value == null);
const solDigit = (i: number) => Number(SOLUTIONS[S().game!.puzzleId]![i]);

describe("M2 store (§4-§22)", () => {
  beforeEach(reset);
  afterEach(() => __resetNowForTests());

  // ---------- Notes ----------
  describe("Notes", () => {
    it("add note then remove note (toggle) via Core, persists & restores", () => {
      S().startNewGame(1);
      S().toggleNoteMode();
      const cell = firstEmpty();
      S().selectCell(cell);
      S().enterDigit(3); // add
      expect(S().game!.board[cell]!.userNotes).toContain(3);
      expect(loadActiveGame()!.board[cell]!.userNotes).toContain(3);

      S().enterDigit(3); // remove
      expect(S().game!.board[cell]!.userNotes).not.toContain(3);

      S().enterDigit(5);
      // restore
      const saved = S().game!.gameId;
      useGameStore.setState({ game: null, restoreAttempted: false });
      S().restoreGame();
      expect(S().game!.gameId).toBe(saved);
      expect(S().game!.board[cell]!.userNotes).toEqual([5]);
    });

    it("userNotes do NOT affect logical candidates / hint", () => {
      const parsed = parsePuzzle(DEV_PUZZLES[0]!.puzzle);
      if (!parsed.ok) throw new Error("fixture");
      const empty = parsed.board.findIndex((c) => c.value == null);
      const before = getCandidates(parsed.board, empty);
      // pollute userNotes with a bogus note
      parsed.board[empty] = { ...parsed.board[empty]!, userNotes: [1, 2, 3, 4, 5] };
      const after = getCandidates(parsed.board, empty);
      expect(after).toEqual(before); // candidates unaffected by userNotes
      const hint = getHintView(parsed.board, 1, 2);
      expect(hint.available).toBe(true);
    });
  });

  // ---------- Undo ----------
  describe("Undo", () => {
    it("undo set-value restores previous state", () => {
      S().startNewGame(1);
      S().setErrorMode("unchecked");
      const cell = firstEmpty();
      S().selectCell(cell);
      S().enterDigit(9);
      expect(S().game!.board[cell]!.value).toBe(9);
      S().undo();
      expect(S().game!.board[cell]!.value).toBeNull();
    });

    it("undo clear-value restores the cleared value", () => {
      S().startNewGame(1);
      S().setErrorMode("unchecked");
      const cell = firstEmpty();
      S().selectCell(cell);
      S().enterDigit(8);
      S().clearSelectedCell();
      expect(S().game!.board[cell]!.value).toBeNull();
      S().undo();
      expect(S().game!.board[cell]!.value).toBe(8);
    });

    it("undo toggle-note restores notes", () => {
      S().startNewGame(1);
      S().toggleNoteMode();
      const cell = firstEmpty();
      S().selectCell(cell);
      S().enterDigit(4);
      expect(S().game!.board[cell]!.userNotes).toEqual([4]);
      S().undo();
      expect(S().game!.board[cell]!.userNotes).toEqual([]);
    });

    it("undo hint-fill removes the filled value", () => {
      S().startNewGame(1);
      S().requestHint(3);
      const fill = (S().hint as any).fill;
      expect(fill).not.toBeNull();
      S().applyHintFill();
      expect(S().game!.board[fill.cellIndex]!.value).toBe(fill.digit);
      const dc = S().game!.directHintCount;
      S().undo();
      expect(S().game!.board[fill.cellIndex]!.value).toBeNull();
      // stat counters are not rolled back (stats only, §22) — undo restores board only
      expect(S().game!.directHintCount).toBe(dc);
    });

    it("undo survives refresh (undoStack persisted)", () => {
      S().startNewGame(1);
      S().setErrorMode("unchecked");
      const cell = firstEmpty();
      S().selectCell(cell);
      S().enterDigit(7);
      useGameStore.setState({ game: null, restoreAttempted: false });
      S().restoreGame();
      expect(S().game!.undoStack.length).toBeGreaterThan(0);
      S().undo();
      expect(S().game!.board[cell]!.value).toBeNull();
    });

    it("undo on empty stack is safe (no throw, no change)", () => {
      S().startNewGame(1);
      const before = S().game!.board;
      S().undo();
      expect(S().game!.board).toEqual(before);
    });
  });

  // ---------- Error modes ----------
  describe("Error Modes", () => {
    it("gentle: wrong value is not committed and no error count/game-over", () => {
      S().startNewGame(1); // gentle default
      const cell = firstEmpty();
      const correct = solDigit(cell);
      const wrong = correct === 9 ? 1 : correct + 1;
      S().selectCell(cell);
      S().enterDigit(wrong);
      expect(S().game!.board[cell]!.value).toBeNull(); // not committed
      expect(S().gentleError).not.toBeNull();
      expect(S().status).not.toBe("completed");
    });

    it("gentle: correct value commits normally", () => {
      S().startNewGame(1);
      const cell = firstEmpty();
      S().selectCell(cell);
      S().enterDigit(solDigit(cell));
      expect(S().game!.board[cell]!.value).toBe(solDigit(cell));
      expect(S().gentleError).toBeNull();
    });

    it("gentle: clearGentleError removes the ephemeral message", () => {
      S().startNewGame(1);
      const cell = firstEmpty();
      const wrong = solDigit(cell) === 9 ? 1 : solDigit(cell) + 1;
      S().selectCell(cell);
      S().enterDigit(wrong);
      expect(S().gentleError).not.toBeNull();
      S().clearGentleError();
      expect(S().gentleError).toBeNull();
    });

    it("unchecked: a wrong value (conflict) is allowed and persists across refresh", () => {
      S().startNewGame(1);
      S().setErrorMode("unchecked");
      const cell = firstEmpty();
      const wrong = solDigit(cell) === 9 ? 1 : solDigit(cell) + 1;
      S().selectCell(cell);
      S().enterDigit(wrong);
      expect(S().game!.board[cell]!.value).toBe(wrong);
      useGameStore.setState({ game: null, restoreAttempted: false });
      S().restoreGame();
      expect(S().game!.board[cell]!.value).toBe(wrong);
    });

    it("error mode setting is persisted and restored", () => {
      S().startNewGame(1);
      S().setErrorMode("unchecked");
      expect(loadSettings().errorMode).toBe("unchecked");
      useGameStore.setState({ errorMode: "gentle" });
      S().restoreGame();
      expect(S().errorMode).toBe("unchecked");
    });
  });

  // ---------- Timer (store integration, injected clock) ----------
  describe("Timer", () => {
    it("start → pauseForHidden → resumeFromVisible excludes background time", () => {
      setClock(0);
      S().startNewGame(1);
      setClock(5000);
      S().pauseForHidden(); // 5s active
      setClock(105000); // 100s background
      S().resumeFromVisible();
      setClock(110000); // +5s active
      const t = S().game!.timer;
      expect(elapsedMs(t, 110000)).toBe(10000); // 10s, bg excluded
    });

    it("refresh does not reset or double-count the timer", () => {
      setClock(0);
      S().startNewGame(1);
      setClock(5000);
      S().pauseForHidden(); // persist paused at 5s
      // simulate refresh
      useGameStore.setState({ game: null, restoreAttempted: false });
      setClock(200000); // long background before reload
      S().restoreGame();
      setClock(203000); // +3s after reload
      expect(elapsedMs(S().game!.timer, 203000)).toBe(8000); // 5s + 3s, no bg counted
    });

    it("completion elapsed is exposed and frozen", () => {
      setClock(0);
      S().startNewGame(1);
      const puzzleId = S().game!.puzzleId;
      const solution = SOLUTIONS[puzzleId]!;
      const board0 = S().game!.board;
      setClock(30000); // 30s to solve
      for (let i = 0; i < 81; i++) {
        if (board0[i]!.given) continue;
        S().selectCell(i);
        S().enterDigit(Number(solution[i]));
      }
      expect(S().status).toBe("completed");
      expect(S().completedElapsedMs).toBe(30000);
    });
  });

  // ---------- Hint ----------
  describe("Hint", () => {
    it("layer 1 guides a region; layer 2 explains; layer 3 offers a placement fill", () => {
      S().startNewGame(1);
      S().requestHint(1);
      expect((S().hint as any).layer).toBe(1);
      S().requestHint(2);
      expect((S().hint as any).layer).toBe(2);
      S().requestHint(3);
      const h = S().hint as any;
      expect(h.layer).toBe(3);
      expect(h.fill).not.toBeNull();
    });

    it("hint request increments hintCount; fill increments directHintCount (stats only)", () => {
      S().startNewGame(1);
      S().requestHint(1);
      expect(S().game!.hintCount).toBe(1);
      S().requestHint(3);
      expect(S().game!.hintCount).toBe(2);
      S().applyHintFill();
      expect(S().game!.directHintCount).toBe(1);
    });

    it("hint fill matches the verified solution (never fabricates)", () => {
      S().startNewGame(1);
      S().requestHint(3);
      const { cellIndex, digit } = (S().hint as any).fill;
      expect(digit).toBe(solDigit(cellIndex));
    });
  });
});
