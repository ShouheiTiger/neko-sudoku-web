// Zustand game store (§12). All Sudoku rules delegate to the M0 Game Engine — the store
// never re-implements row/col/box/candidate/solution logic (§12, §29).
import { create } from "zustand";
import { setValue, clearValue, isCompleted } from "../game-engine.js";
import { parsePuzzle } from "../board.js";
import type { BoardState } from "../types.js";
import { DEV_PUZZLES, puzzlesForDifficulty } from "../data/dev-puzzles.js";
import {
  saveActiveGame,
  clearActiveGame,
  loadActiveGame,
} from "../storage/gameStorage.js";
import { SCHEMA_VERSION, ENGINE_VERSION, type ActiveGame } from "../storage/schemas.js";

type Difficulty = 1 | 2 | 3 | 4;

export type GameStatus = "idle" | "playing" | "completed";

export type GameState = {
  status: GameStatus;
  game: ActiveGame | null;
  /** Set true once a restore attempt has run, so /play knows the store is settled. */
  restoreAttempted: boolean;

  startNewGame: (difficulty: Difficulty) => void;
  restoreGame: () => boolean;
  selectCell: (cellIndex: number | null) => void;
  enterDigit: (digit: number) => void;
  clearSelectedCell: () => void;
  abandonGame: () => void;
};

let gameCounter = 0;
function newGameId(): string {
  gameCounter += 1;
  return `g-${Date.now()}-${gameCounter}`;
}

function pickPuzzle(difficulty: Difficulty) {
  const pool = puzzlesForDifficulty(difficulty);
  // Deterministic-ish rotation; M1 does not need randomness guarantees.
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx] ?? pool[0]!;
}

function buildActiveGame(difficulty: Difficulty): ActiveGame | null {
  const puzzle = pickPuzzle(difficulty);
  const parsed = parsePuzzle(puzzle.puzzle);
  if (!parsed.ok) {
    console.error("[nekoSudoku] dev puzzle failed to parse", puzzle.id, parsed.reason);
    return null;
  }
  const now = Date.now();
  return {
    schemaVersion: SCHEMA_VERSION,
    gameId: newGameId(),
    puzzleId: puzzle.id,
    difficulty,
    board: parsed.board,
    selectedCell: null,
    createdAt: now,
    updatedAt: now,
    engineVersion: ENGINE_VERSION,
  };
}

/** Recompute status from the board using the M0 Core (§25) — never counts 81 cells here. */
function statusFor(board: BoardState): GameStatus {
  return isCompleted(board) ? "completed" : "playing";
}

export const useGameStore = create<GameState>((set, get) => ({
  status: "idle",
  game: null,
  restoreAttempted: false,

  startNewGame: (difficulty) => {
    const game = buildActiveGame(difficulty);
    if (!game) return;
    saveActiveGame(game); // §21 save on start
    set({ game, status: statusFor(game.board), restoreAttempted: true });
  },

  restoreGame: () => {
    const loaded = loadActiveGame();
    if (!loaded) {
      set({ restoreAttempted: true });
      return false;
    }
    set({ game: loaded, status: statusFor(loaded.board), restoreAttempted: true });
    return true;
  },

  selectCell: (cellIndex) => {
    const { game } = get();
    if (!game) return;
    const next: ActiveGame = { ...game, selectedCell: cellIndex };
    set({ game: next });
    // Selection alone is not a board mutation; not part of required save events (§21).
  },

  enterDigit: (digit) => {
    const { game } = get();
    if (!game || game.selectedCell == null) return;
    const result = setValue(game.board, game.selectedCell, digit); // M0 Core (§12)
    if (!result.ok) return; // given-cell / invalid-value handled gracefully (no throw)
    const next: ActiveGame = {
      ...game,
      board: result.board,
      updatedAt: Date.now(),
    };
    saveActiveGame(next); // §21 save on set value
    set({ game: next, status: statusFor(next.board) });
  },

  clearSelectedCell: () => {
    const { game } = get();
    if (!game || game.selectedCell == null) return;
    const result = clearValue(game.board, game.selectedCell); // M0 Core (§17)
    if (!result.ok) return; // cannot clear a given
    const next: ActiveGame = {
      ...game,
      board: result.board,
      updatedAt: Date.now(),
    };
    saveActiveGame(next); // §21 save on clear value
    set({ game: next, status: statusFor(next.board) });
  },

  abandonGame: () => {
    clearActiveGame();
    set({ game: null, status: "idle" });
  },
}));

/** Non-hook helper for imperative save (used by visibilitychange/pagehide, §21). */
export function persistCurrentGame(): void {
  const { game } = useGameStore.getState();
  if (game) saveActiveGame(game);
}

export { DEV_PUZZLES };
