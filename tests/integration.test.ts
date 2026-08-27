import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "../src/stores/gameStore.js";

// §31 Integration: start -> input -> save -> reconstruct store -> restore.
// The restored board must equal the board before the simulated reload.
describe("integration: game loop persistence (§31)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useGameStore.setState({ status: "idle", game: null, restoreAttempted: false });
  });

  it("board after restore is identical to board before reload", () => {
    // start
    useGameStore.getState().startNewGame(2);

    // input a few digits into empty cells
    const board = useGameStore.getState().game!.board;
    const empties = board
      .map((c, i) => (c.value == null ? i : -1))
      .filter((i) => i >= 0)
      .slice(0, 3);
    for (const i of empties) {
      useGameStore.getState().selectCell(i);
      useGameStore.getState().enterDigit(((i % 9) as number) + 1);
    }

    const boardBefore = useGameStore.getState().game!.board;
    const idBefore = useGameStore.getState().game!.gameId;

    // simulate browser refresh: drop in-memory store, keep localStorage
    useGameStore.setState({ status: "idle", game: null, restoreAttempted: false });

    // restore
    const ok = useGameStore.getState().restoreGame();
    expect(ok).toBe(true);

    const restored = useGameStore.getState().game!;
    expect(restored.gameId).toBe(idBefore);
    expect(restored.board).toEqual(boardBefore);
  });
});
