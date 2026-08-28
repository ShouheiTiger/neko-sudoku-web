// Zustand game store (M2). All Sudoku rules delegate to the FROZEN M0 Core — the store
// never re-implements row/col/box/candidate/solution/completion logic (§2, §29).
// M2 adds: notes, undo, gentle/unchecked error modes, hidden timer, layered hint.
import { create } from "zustand";
import { setValue, clearValue, toggleNote, isCompleted } from "../game-engine.js";
import { parsePuzzle } from "../board.js";
import type { BoardState, CellState } from "../types.js";
import { DEV_PUZZLES } from "../data/dev-puzzles.js";
import {
  saveActiveGame,
  clearActiveGame,
  loadActiveGame,
  loadSettings,
  saveSettings,
  appendHistoryOnce,
} from "../storage/gameStorage.js";
import {
  selectLoaded,
  loadLevel,
  isLevelLoaded,
  type BankLoadFailure,
  type Level,
} from "../data/bank/loader.js";
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
  /** §45 Non-crashing production-bank load error, surfaced to the New/Play UI. */
  bankError: BankLoadFailure | null;

  startNewGame: (difficulty: Difficulty) => void;
  /** §23/§45 Load + validate a level's production bank into cache. Returns null on success or
   *  a non-crashing failure reason the UI can show. Call before startNewGame. */
  prepareLevel: (difficulty: Difficulty) => Promise<BankLoadFailure | null>;
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
  clearBankError: () => void;
};

let gameCounter = 0;
const newGameId = () => `g-${now()}-${++gameCounter}`;

// §14 SOLUTION RED LINE: the solution is used ONLY for gentle-error and completion validation
// here in the store/adapter. Hint / solver / candidate engine never call this.
// Production games carry a puzzleSnapshot; legacy dev games fall back to the dev pool by id.
function solutionFor(game: ActiveGame): string | null {
  if (game.puzzleSnapshot) return game.puzzleSnapshot.solution;
  return DEV_PUZZLES.find((p) => p.id === game.puzzleId)?.solution ?? null;
}

export type PickedPuzzle = { id: string; puzzle: string; solution: string; bankVersion: string };

/**
 * Synchronous puzzle picker. The default reads from the Production Bank loader's in-memory
 * cache (populated by `prepareLevel`). If the level was NOT preloaded, it returns null and the
 * store surfaces a bankError (§45). Tests inject a deterministic source via
 * `__setPuzzleSourceForTests` so they can run fully synchronously against the dev pool.
 */
type SyncPuzzleSource = (difficulty: Difficulty) => PickedPuzzle | null;
const defaultPuzzleSource: SyncPuzzleSource = (difficulty) => {
  const res = selectLoaded(difficulty as Level);
  if (!res) return null;
  return { id: res.id, puzzle: res.puzzle, solution: res.solution, bankVersion: res.bankVersion };
};
let puzzleSource: SyncPuzzleSource = defaultPuzzleSource;
export function __setPuzzleSourceForTests(fn: SyncPuzzleSource | null): void {
  puzzleSource = fn ?? defaultPuzzleSource;
}

function buildActiveGameFrom(difficulty: Difficulty, src: PickedPuzzle): ActiveGame | null {
  const parsed = parsePuzzle(src.puzzle);
  if (!parsed.ok) {
    console.error("[nekoSudoku] production puzzle failed to parse", src.id, parsed.reason);
    return null;
  }
  const t = now();
  return {
    schemaVersion: SCHEMA_VERSION,
    gameId: newGameId(),
    puzzleId: src.id,
    difficulty,
    board: parsed.board,
    selectedCell: null,
    noteMode: false,
    undoStack: [],
    hintCount: 0,
    directHintCount: 0,
    timer: startTimer(t),
    // §28 carry the snapshot so gentle/completion validation survive refresh w/o loading bank.
    puzzleSnapshot: { puzzle: src.puzzle, solution: src.solution, bankVersion: src.bankVersion },
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
    // M3 §22 completion order: calc elapsed → append history → (only if persisted) clear.
    // M-1 (Gate Medium-1): distinguish written/duplicate/failed. "written" or "duplicate"
    // mean the completion is durably recorded → safe to clear the finished activeGame.
    // "failed" (quota/security/invalid) means NOTHING was persisted → KEEP activeGame so the
    // completion can be retried next time /play is entered (§2.5 always recoverable). None of
    // these throw, so the completion UI never crashes (§32).
    const historyResult = appendHistoryOnce({
      gameId: next.gameId,
      puzzleId: next.puzzleId,
      difficulty: next.difficulty,
      completedAt: now(),
      elapsedMs: completedElapsedMs,
    });
    if (historyResult === "written" || historyResult === "duplicate") {
      // FIX-1 (Gate Medium-1, M2): a finished + recorded board is NOT an "active game".
      // Clear the persistent activeGame so Home never offers "继续上一局" (§7.1 semantics).
      // The in-memory `game` is kept so the completion page can still show 🐱 + elapsed time.
      clearActiveGame();
    } else {
      // history write failed → keep the completed board persisted for a retry. The board is
      // already complete, so re-entering /play re-runs commit() and re-attempts the write.
      saveActiveGame(next);
    }
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
  bankError: null,

  startNewGame: (difficulty) => {
    const src = puzzleSource(difficulty);
    if (!src) {
      // Level not loaded / empty → surface a gentle, non-crashing error (§45). No activeGame.
      set({ bankError: isLevelLoaded(difficulty as Level) ? "empty" : "network" });
      return;
    }
    const game = buildActiveGameFrom(difficulty, src);
    if (!game) {
      set({ bankError: "invalid-schema" });
      return;
    }
    saveActiveGame(game); // §21 save on start
    set({
      game,
      status: statusFor(game.board),
      restoreAttempted: true,
      gentleError: null,
      hint: null,
      completedElapsedMs: null,
      bankError: null,
    });
  },

  prepareLevel: async (difficulty) => {
    const res = await loadLevel(difficulty as Level);
    if (!res.ok) {
      set({ bankError: res.reason });
      return res.reason;
    }
    set({ bankError: null });
    return null;
  },

  clearBankError: () => set({ bankError: null }),

  restoreGame: () => {
    const settings = loadSettings();
    const loaded = loadActiveGame(undefined, now());
    if (!loaded) {
      set({ restoreAttempted: true, errorMode: settings.errorMode });
      return false;
    }

    // M-1 retry: a persisted board can only still be "active" (unfinished) OR a completed
    // board whose history write previously FAILED (we keep it for retry, §2.5). If it is
    // already completed, do NOT resume its timer (it was frozen at completion); re-run the
    // completion side-effects via commit() so history is (re)attempted and, on success, the
    // activeGame is cleared. appendHistoryOnce is idempotent by gameId → no duplicate row.
    if (statusFor(loaded.board) === "completed") {
      set({ errorMode: settings.errorMode, gentleError: null, hint: null, restoreAttempted: true });
      commit(set, loaded); // recomputes completed, retries history, clears on success
      return true;
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
      const solution = solutionFor(game);
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
