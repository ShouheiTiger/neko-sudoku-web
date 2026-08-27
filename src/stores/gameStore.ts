// Zustand game store (M2). All Sudoku rules delegate to the FROZEN M0 Core — the store
// never re-implements row/col/box/candidate/solution/completion logic (§2, §29).
// M2 adds: notes, undo, gentle/unchecked error modes, hidden timer, layered hint.
import { create } from "zustand";
import { setValue, clearValue, toggleNote, isCompleted } from "../game-engine.js";
import { parsePuzzle } from "../board.js";
import type { BoardState, CellState } from "../types.js";
import { DEV_PUZZLES, puzzlesForDifficulty } from "../data/dev-puzzles.js";
import {
  saveActiveGame,
  clearActiveGame,
  loadActiveGame,
  loadSettings,
  saveSettings,
  appendHistoryOnce,
} from "../storage/gameStorage.js";
import {
  SCHEMA_VERSION,
  ENGINE_VERSION,
  UNDO_STACK_LIMIT,
  type ActiveGame,
  type GameAction,
  type ErrorMode,
  type TimerState,
} from "../storage/schemas.js";
import { startTimer, pauseTimer, resumeTimer, completeTimer, elapsedMs } from "../lib/timer.js";
import { getHintView, type HintView } from "../lib/hintService.js";

type Difficulty = 1 | 2 | 3 | 4;
export type GameStatus = "idle" | "playing" | "completed";

// Injectable clock so timer tests use fake timers / a fixed value (§26). Default = Date.now.
let nowFn: () => number = () => Date.now();
export function __setNowForTests(fn: () => number): void {
  nowFn = fn;
}
export function __resetNowForTests(): void {
  nowFn = () => Date.now();
}
const now = () => nowFn();

// FIX-2 (Gate Medium-2): injectable visibility so restore tests are deterministic. Default
// reads document.visibilityState; when document is unavailable (SSR/tests) we treat the page
// as visible.
let visibilityFn: () => "visible" | "hidden" = () =>
  typeof document !== "undefined" && document.visibilityState === "hidden"
    ? "hidden"
    : "visible";
export function __setVisibilityForTests(fn: () => "visible" | "hidden"): void {
  visibilityFn = fn;
}
export function __resetVisibilityForTests(): void {
  visibilityFn = () =>
    typeof document !== "undefined" && document.visibilityState === "hidden"
      ? "hidden"
      : "visible";
}

/**
 * FIX-2: resume a restored timer ONLY if the page is currently visible. If the JS context is
 * (re)loaded while the tab is hidden, we first fold any dangling active span up to `now`
 * (pauseTimer), then leave it paused — so background time is never counted as active. When
 * visible, we fold then resume from now (normal foreground refresh behaviour, unchanged).
 */
function resumeTimerForRestore(t: TimerState, at: number): TimerState {
  const paused = pauseTimer(t, at); // idempotent if already paused; no double accumulate
  return visibilityFn() === "hidden" ? paused : resumeTimer(paused, at);
}

export type GameState = {
  status: GameStatus;
  game: ActiveGame | null;
  restoreAttempted: boolean;
  errorMode: ErrorMode;
  /** Ephemeral gentle-mode error (not persisted, §11): the cell the wrong digit went into. */
  gentleError: { cellIndex: number; digit: number } | null;
  /** Ephemeral current hint view (not persisted). */
  hint: HintView | null;
  /** Elapsed ms shown ONLY on the completion page (§16). Never shown while playing (§14). */
  completedElapsedMs: number | null;

  startNewGame: (difficulty: Difficulty) => void;
  restoreGame: () => boolean;
  selectCell: (cellIndex: number | null) => void;
  enterDigit: (digit: number) => void;
  clearSelectedCell: () => void;
  toggleNoteMode: () => void;
  clearGentleError: () => void;
  undo: () => void;
  setErrorMode: (mode: ErrorMode) => void;
  requestHint: (layer: 1 | 2 | 3) => void;
  applyHintFill: () => void;
  dismissHint: () => void;
  pauseForHidden: () => void;
  resumeFromVisible: () => void;
  abandonGame: () => void;
};

let gameCounter = 0;
const newGameId = () => `g-${now()}-${++gameCounter}`;

function pickPuzzle(difficulty: Difficulty) {
  const pool = puzzlesForDifficulty(difficulty);
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx] ?? pool[0]!;
}

function solutionFor(puzzleId: string): string | null {
  return DEV_PUZZLES.find((p) => p.id === puzzleId)?.solution ?? null;
}

function buildActiveGame(difficulty: Difficulty): ActiveGame | null {
  const puzzle = pickPuzzle(difficulty);
  const parsed = parsePuzzle(puzzle.puzzle);
  if (!parsed.ok) {
    console.error("[nekoSudoku] dev puzzle failed to parse", puzzle.id, parsed.reason);
    return null;
  }
  const t = now();
  return {
    schemaVersion: SCHEMA_VERSION,
    gameId: newGameId(),
    puzzleId: puzzle.id,
    difficulty,
    board: parsed.board,
    selectedCell: null,
    noteMode: false,
    undoStack: [],
    hintCount: 0,
    directHintCount: 0,
    timer: startTimer(t),
    createdAt: t,
    updatedAt: t,
    engineVersion: ENGINE_VERSION,
  };
}

function statusFor(board: BoardState): GameStatus {
  return isCompleted(board) ? "completed" : "playing";
}

const snapshot = (c: CellState): CellState => ({
  given: c.given,
  value: c.value,
  userNotes: [...c.userNotes],
});

/** Push an action, honoring the max stack length (§9). */
function pushAction(stack: GameAction[], action: GameAction): GameAction[] {
  const next = [...stack, action];
  return next.length > UNDO_STACK_LIMIT ? next.slice(next.length - UNDO_STACK_LIMIT) : next;
}

/** Commit a new game state: recompute status, freeze timer on completion, persist. */
function commit(
  set: (partial: Partial<GameState>) => void,
  game: ActiveGame,
  extra: Partial<GameState> = {},
): void {
  let next = game;
  const status = statusFor(next.board);
  let completedElapsedMs: number | null = null;
  if (status === "completed") {
    const stopped = completeTimer(next.timer, now());
    next = { ...next, timer: stopped };
    completedElapsedMs = elapsedMs(stopped, now());
    // M3 §22 completion order: calc elapsed → append history EXACTLY ONCE → clear activeGame.
    // appendHistoryOnce is idempotent by gameId and never throws, so repeated completion
    // commits / rerenders / lifecycle events cannot duplicate or crash (§22/§32).
    appendHistoryOnce({
      gameId: next.gameId,
      puzzleId: next.puzzleId,
      difficulty: next.difficulty,
      completedAt: now(),
      elapsedMs: completedElapsedMs,
    });
    // FIX-1 (Gate Medium-1): a finished board is NOT an "active game". Clear the persistent
    // activeGame so Home never offers "继续上一局" for a completed board (§7.1 semantics).
    // The in-memory `game` is kept so the completion page can still show 🐱 + elapsed time.
    clearActiveGame();
  } else {
    saveActiveGame(next);
  }
  set({ game: next, status, ...(completedElapsedMs != null ? { completedElapsedMs } : {}), ...extra });
}

export const useGameStore = create<GameState>((set, get) => ({
  status: "idle",
  game: null,
  restoreAttempted: false,
  errorMode: "gentle",
  gentleError: null,
  hint: null,
  completedElapsedMs: null,

  startNewGame: (difficulty) => {
    const game = buildActiveGame(difficulty);
    if (!game) return;
    saveActiveGame(game); // §21 save on start
    set({
      game,
      status: statusFor(game.board),
      restoreAttempted: true,
      gentleError: null,
      hint: null,
      completedElapsedMs: null,
    });
  },

  restoreGame: () => {
    const settings = loadSettings();
    const loaded = loadActiveGame(undefined, now());
    if (!loaded) {
      set({ restoreAttempted: true, errorMode: settings.errorMode });
      return false;
    }
    // On resume, timer must not count background time. FIX-2: only resume if the page is
    // currently visible; if the JS context reloaded while hidden, keep it paused so the
    // background span is not counted as active.
    const resumed = { ...loaded, timer: resumeTimerForRestore(loaded.timer, now()) };
    set({
      game: resumed,
      status: statusFor(resumed.board),
      restoreAttempted: true,
      errorMode: settings.errorMode,
      gentleError: null,
      hint: null,
      completedElapsedMs: null,
    });
    return true;
  },

  selectCell: (cellIndex) => {
    const { game } = get();
    if (!game) return;
    set({ game: { ...game, selectedCell: cellIndex }, gentleError: null });
  },

  enterDigit: (digit) => {
    const { game, errorMode } = get();
    if (!game || game.selectedCell == null) return;
    const idx = game.selectedCell;
    const cell = game.board[idx]!;
    if (cell.given) return;

    // Note mode → toggle a candidate note via M0 Core (§6). Undoable.
    if (game.noteMode) {
      const result = toggleNote(game.board, idx, digit);
      if (!result.ok) return;
      const action: GameAction = {
        type: "toggle-note",
        cellIndex: idx,
        before: snapshot(cell),
        after: snapshot(result.board[idx]!),
        timestamp: now(),
      };
      commit(set, { ...game, board: result.board, undoStack: pushAction(game.undoStack, action), updatedAt: now() });
      return;
    }

    // gentle mode: if the digit is wrong vs the verified solution, show an ephemeral
    // message and DO NOT commit the wrong value (§11). Judgement lives here (store/adapter),
    // not in a React component, and compares against the puzzle definition, not solver.
    if (errorMode === "gentle") {
      const solution = solutionFor(game.puzzleId);
      if (solution && Number(solution[idx]) !== digit) {
        set({ gentleError: { cellIndex: idx, digit } });
        return; // auto-clear handled by UI after ~1.5s via clearGentleError()
      }
    }

    // Normal fill via M0 Core (both modes). Undoable.
    const result = setValue(game.board, idx, digit);
    if (!result.ok) return;
    const action: GameAction = {
      type: "set-value",
      cellIndex: idx,
      before: snapshot(cell),
      after: snapshot(result.board[idx]!),
      timestamp: now(),
    };
    commit(set, { ...game, board: result.board, undoStack: pushAction(game.undoStack, action), updatedAt: now() }, { gentleError: null, hint: null });
  },

  clearSelectedCell: () => {
    const { game } = get();
    if (!game || game.selectedCell == null) return;
    const idx = game.selectedCell;
    const cell = game.board[idx]!;
    const result = clearValue(game.board, idx);
    if (!result.ok) return; // cannot clear a given
    const action: GameAction = {
      type: "clear-value",
      cellIndex: idx,
      before: snapshot(cell),
      after: snapshot(result.board[idx]!),
      timestamp: now(),
    };
    commit(set, { ...game, board: result.board, undoStack: pushAction(game.undoStack, action), updatedAt: now() }, { gentleError: null });
  },

  toggleNoteMode: () => {
    const { game } = get();
    if (!game) return;
    const next = { ...game, noteMode: !game.noteMode };
    saveActiveGame(next);
    set({ game: next });
  },

  clearGentleError: () => set({ gentleError: null }),

  undo: () => {
    const { game } = get();
    if (!game || game.undoStack.length === 0) return; // empty stack is safe (§26)
    const stack = [...game.undoStack];
    const last = stack.pop()!;
    // Restore the exact before-snapshot (value + userNotes), never touching `given`.
    const board = game.board.map((c, i) => (i === last.cellIndex ? snapshot(last.before) : c));
    commit(set, { ...game, board, undoStack: stack, updatedAt: now() }, { gentleError: null, hint: null });
  },

  setErrorMode: (mode) => {
    // Preserve M3 settings (largeText/tutorialSeen) when updating errorMode.
    const current = loadSettings();
    saveSettings({ ...current, errorMode: mode });
    set({ errorMode: mode, gentleError: null });
  },

  requestHint: (layer) => {
    const { game } = get();
    if (!game) return;
    const view = getHintView(game.board, game.difficulty, layer);
    // hintCount counts hint requests (product stats only, §22). Not used for scoring.
    const next = { ...game, hintCount: game.hintCount + 1 };
    saveActiveGame(next);
    set({ game: next, hint: view });
  },

  applyHintFill: () => {
    const { game, hint } = get();
    if (!game || !hint || !hint.available || hint.layer !== 3 || !hint.fill) return;
    const { cellIndex, digit } = hint.fill;
    const cell = game.board[cellIndex]!;
    const result = setValue(game.board, cellIndex, digit); // M0 Core (§20)
    if (!result.ok) return;
    const action: GameAction = {
      type: "hint-fill",
      cellIndex,
      before: snapshot(cell),
      after: snapshot(result.board[cellIndex]!),
      timestamp: now(),
    };
    commit(
      set,
      {
        ...game,
        board: result.board,
        selectedCell: cellIndex,
        undoStack: pushAction(game.undoStack, action),
        directHintCount: game.directHintCount + 1, // §22 stats only
        updatedAt: now(),
      },
      { hint: null },
    );
  },

  dismissHint: () => set({ hint: null }),

  pauseForHidden: () => {
    const { game } = get();
    if (!game || get().status === "completed") return;
    const next = { ...game, timer: pauseTimer(game.timer, now()) };
    saveActiveGame(next); // §15 pause THEN persist
    set({ game: next });
  },

  resumeFromVisible: () => {
    const { game } = get();
    if (!game || get().status === "completed") return;
    set({ game: { ...game, timer: resumeTimer(game.timer, now()) } });
  },

  abandonGame: () => {
    clearActiveGame();
    set({ game: null, status: "idle", gentleError: null, hint: null, completedElapsedMs: null });
  },
}));

/** Imperative save used by visibilitychange/pagehide (§15/§21). */
export function persistCurrentGame(): void {
  const { game, status } = useGameStore.getState();
  // FIX-1 (Gate Medium-1): never re-write a completed game back into activeGame — a finished
  // board must not resurrect as an "active game" via a lifecycle event.
  if (game && status !== "completed") saveActiveGame(game);
}

export { DEV_PUZZLES };
