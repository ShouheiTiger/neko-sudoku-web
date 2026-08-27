import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "../src/stores/gameStore.js";
import { loadActiveGame } from "../src/storage/gameStorage.js";
import { isCompleted } from "../src/game-engine.js";
import { DEV_PUZZLES } from "../src/data/dev-puzzles.js";

const SOLUTIONS: Record<string, string> = Object.fromEntries(
  DEV_PUZZLES.map((p) => [p.id, p.solution]),
);

// §31 Store tests: start / select / enter / clear / restore.
function reset() {
  window.localStorage.clear();
  useGameStore.setState({ status: "idle", game: null, restoreAttempted: false });
}

describe("gameStore (§12, §31)", () => {
  beforeEach(reset);

  it("startNewGame builds a playing game for the chosen difficulty and saves it", () => {
    useGameStore.getState().startNewGame(3);
    const s = useGameStore.getState();
    expect(s.game).not.toBeNull();
    expect(s.game!.difficulty).toBe(3);
    expect(s.status).toBe("playing");
    // §21 saved on start
    expect(loadActiveGame()).not.toBeNull();
  });

  it("selectCell sets selectedCell without mutating the board", () => {
    useGameStore.getState().startNewGame(1);
    const before = useGameStore.getState().game!.board;
    useGameStore.getState().selectCell(40);
    const after = useGameStore.getState().game!;
    expect(after.selectedCell).toBe(40);
    expect(after.board).toEqual(before);
  });

  it("enterDigit fills an empty cell via M0 setValue and persists", () => {
    useGameStore.getState().startNewGame(1);
    const empty = useGameStore.getState().game!.board.findIndex((c) => c.value == null);
    useGameStore.getState().selectCell(empty);
    useGameStore.getState().enterDigit(7);
    expect(useGameStore.getState().game!.board[empty]!.value).toBe(7);
    expect(loadActiveGame()!.board[empty]!.value).toBe(7);
  });

  it("enterDigit refuses to modify a given cell (uses Core MoveResult, no throw)", () => {
    useGameStore.getState().startNewGame(1);
    const given = useGameStore.getState().game!.board.findIndex((c) => c.given);
    const gVal = useGameStore.getState().game!.board[given]!.value;
    useGameStore.getState().selectCell(given);
    useGameStore.getState().enterDigit(gVal === 9 ? 1 : 9);
    // unchanged
    expect(useGameStore.getState().game!.board[given]!.value).toBe(gVal);
  });

  it("clearSelectedCell clears a user value and persists", () => {
    useGameStore.getState().startNewGame(1);
    const empty = useGameStore.getState().game!.board.findIndex((c) => c.value == null);
    useGameStore.getState().selectCell(empty);
    useGameStore.getState().enterDigit(5);
    useGameStore.getState().clearSelectedCell();
    expect(useGameStore.getState().game!.board[empty]!.value).toBeNull();
    expect(loadActiveGame()!.board[empty]!.value).toBeNull();
  });

  it("restoreGame rebuilds the store from persisted storage", () => {
    useGameStore.getState().startNewGame(2);
    const empty = useGameStore.getState().game!.board.findIndex((c) => c.value == null);
    useGameStore.getState().selectCell(empty);
    useGameStore.getState().enterDigit(4);
    const savedId = useGameStore.getState().game!.gameId;

    // Simulate a fresh page load: wipe in-memory store only.
    useGameStore.setState({ status: "idle", game: null, restoreAttempted: false });

    const ok = useGameStore.getState().restoreGame();
    expect(ok).toBe(true);
    const g = useGameStore.getState().game!;
    expect(g.gameId).toBe(savedId);
    expect(g.board[empty]!.value).toBe(4);
  });

  it("restoreGame returns false and stays idle when nothing is stored", () => {
    const ok = useGameStore.getState().restoreGame();
    expect(ok).toBe(false);
    expect(useGameStore.getState().game).toBeNull();
    expect(useGameStore.getState().restoreAttempted).toBe(true);
  });

  it("completion: filling to the solution sets status=completed (via M0 isCompleted)", () => {
    useGameStore.getState().startNewGame(1);
    const puzzleId = useGameStore.getState().game!.puzzleId;
    const solution = SOLUTIONS[puzzleId]!;
    // Fill every non-given cell with the solution digit.
    const board0 = useGameStore.getState().game!.board;
    for (let i = 0; i < 81; i++) {
      if (board0[i]!.given) continue;
      useGameStore.getState().selectCell(i);
      useGameStore.getState().enterDigit(Number(solution[i]));
    }
    const g = useGameStore.getState().game!;
    expect(isCompleted(g.board)).toBe(true);
    expect(useGameStore.getState().status).toBe("completed");

    // §25 abandonGame clears activeGame so it is not offered as "继续上一局".
    useGameStore.getState().abandonGame();
    expect(loadActiveGame()).toBeNull();
    expect(useGameStore.getState().game).toBeNull();
  });
});
