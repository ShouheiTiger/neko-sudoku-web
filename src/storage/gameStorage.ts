// localStorage persistence (§20-§23; M2 §13/§24/§25).
// Save path: activeGame -> envelope(v2) -> JSON.stringify -> localStorage.
// Restore path: getItem -> JSON.parse -> Zod validate (v2, else migrate v1) -> puzzleId check.
// On ANY failure we log a diagnostic, drop the corrupted entry, and return null (caller
// then redirects to home). We never `JSON.parse(...) as ActiveGame` (§22).
import { DEV_PUZZLES } from "../data/dev-puzzles.js";
import { startTimer } from "../lib/timer.js";
import {
  activeGameSchema,
  envelopeSchema,
  envelopeSchemaV1,
  activeGameSchemaV1,
  settingsSchema,
  settingsSchemaV1,
  historyEnvelopeSchema,
  historyRecordSchema,
  SCHEMA_VERSION,
  SETTINGS_SCHEMA_VERSION,
  HISTORY_SCHEMA_VERSION,
  HISTORY_LIMIT,
  type ActiveGame,
  type ActiveGameV1,
  type Settings,
  type ErrorMode,
  type HistoryRecord,
} from "./schemas.js";

export const ACTIVE_GAME_KEY = "nekoSudoku.activeGame";
export const SETTINGS_KEY = "nekoSudoku.settings";
export const HISTORY_KEY = "nekoSudoku.history";

type Storage = Pick<Window["localStorage"], "getItem" | "setItem" | "removeItem">;

function getStore(store?: Storage): Storage | null {
  if (store) return store;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// ---------------- Active game ----------------

export function saveActiveGame(game: ActiveGame, store?: Storage): void {
  const s = getStore(store);
  if (!s) return;
  const envelope = { schemaVersion: SCHEMA_VERSION, savedAt: Date.now(), data: game };
  try {
    s.setItem(ACTIVE_GAME_KEY, JSON.stringify(envelope));
  } catch (err) {
    console.warn("[nekoSudoku] failed to persist active game:", err);
  }
}

export function clearActiveGame(store?: Storage): void {
  const s = getStore(store);
  if (!s) return;
  try {
    s.removeItem(ACTIVE_GAME_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * M2 §25 migrate a validated v1 ActiveGame to v2 with safe defaults. We do NOT delete old
 * M1 saves. The v1 board has no timer info, so we start the timer at `now` (documented in
 * M2_REPORT.md) — background/paused time before migration cannot be reconstructed.
 */
export function migrateV1ToV2(v1: ActiveGameV1, now: number): ActiveGame {
  return {
    schemaVersion: SCHEMA_VERSION,
    gameId: v1.gameId,
    puzzleId: v1.puzzleId,
    difficulty: v1.difficulty,
    board: v1.board,
    selectedCell: v1.selectedCell,
    noteMode: false,
    undoStack: [],
    hintCount: 0,
    directHintCount: 0,
    timer: startTimer(now),
    createdAt: v1.createdAt,
    updatedAt: now,
    engineVersion: v1.engineVersion,
  };
}

export function loadActiveGame(store?: Storage, now: number = Date.now()): ActiveGame | null {
  const s = getStore(store);
  if (!s) return null;

  let raw: string | null;
  try {
    raw = s.getItem(ACTIVE_GAME_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  const drop = (reason: string, extra?: unknown) => {
    console.warn(`[nekoSudoku] dropping corrupted active game (${reason})`, extra ?? "");
    clearActiveGame(s);
    return null;
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return drop("invalid-json", err);
  }

  // 1) Current v2 envelope.
  const env = envelopeSchema.safeParse(parsed);
  if (env.success) return validateSemantics(env.data.data, drop);

  // 2) v1 envelope → migrate.
  const envV1 = envelopeSchemaV1.safeParse(parsed);
  if (envV1.success) {
    const migrated = migrateV1ToV2(envV1.data.data, now);
    const ok = validateSemantics(migrated, drop);
    if (ok) saveActiveGame(ok, s); // persist migrated form
    return ok;
  }

  // 3) Bare shapes (defensive): try v2 data, then v1 data → migrate.
  const bareV2 = activeGameSchema.safeParse(parsed);
  if (bareV2.success) return validateSemantics(bareV2.data, drop);

  const bareV1 = activeGameSchemaV1.safeParse(parsed);
  if (bareV1.success) {
    const migrated = migrateV1ToV2(bareV1.data, now);
    const ok = validateSemantics(migrated, drop);
    if (ok) saveActiveGame(ok, s);
    return ok;
  }

  return drop("schema-invalid", env.error.issues);
}

function validateSemantics(
  game: ActiveGame,
  drop: (reason: string, extra?: unknown) => null,
): ActiveGame | null {
  // puzzleId must exist in the known pool (§23).
  if (!DEV_PUZZLES.some((p) => p.id === game.puzzleId)) return drop("unknown-puzzle-id");
  // We deliberately do NOT reject a board merely because the user's in-progress entries
  // conflict: under "unchecked" mode (§12/§37.2) duplicates are a legal mid-game state and
  // §2.5 requires the game to always be recoverable. Structural legality is enforced by Zod.
  return game;
}

// ---------------- Settings (M2 errorMode + M3 largeText/tutorialSeen) ----------------

export const DEFAULT_ERROR_MODE: ErrorMode = "gentle";
export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  errorMode: DEFAULT_ERROR_MODE,
  largeText: false,
  tutorialSeen: false,
};

export function saveSettings(settings: Settings, store?: Storage): void {
  const s = getStore(store);
  if (!s) return;
  try {
    s.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn("[nekoSudoku] failed to persist settings:", err);
  }
}

/** M3 §14 migrate v1 (errorMode-only) settings to v2 with safe defaults. */
export function migrateSettingsV1ToV2(errorMode: ErrorMode): Settings {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    errorMode,
    largeText: false,
    tutorialSeen: false,
  };
}

/** Load settings; migrate v1→v2; on any corruption fall back to defaults (never throw). */
export function loadSettings(store?: Storage): Settings {
  const fallback: Settings = { ...DEFAULT_SETTINGS };
  const s = getStore(store);
  if (!s) return fallback;

  let raw: string | null;
  try {
    raw = s.getItem(SETTINGS_KEY);
  } catch {
    return fallback;
  }
  if (!raw) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn("[nekoSudoku] settings JSON invalid; using defaults");
    return fallback;
  }

  // Current v2.
  const v2 = settingsSchema.safeParse(parsed);
  if (v2.success) return v2.data;

  // M2 v1 → migrate (do NOT delete existing M2 settings).
  const v1 = settingsSchemaV1.safeParse(parsed);
  if (v1.success) {
    const migrated = migrateSettingsV1ToV2(v1.data.errorMode);
    saveSettings(migrated, s); // persist migrated form
    return migrated;
  }

  console.warn("[nekoSudoku] settings schema mismatch; using defaults");
  return fallback;
}

// ---------------- History (M3 §20-§23) ----------------

/** Load the history records (newest-first). Corrupted/unknown → [] (never throw). */
export function loadHistory(store?: Storage): HistoryRecord[] {
  const s = getStore(store);
  if (!s) return [];
  let raw: string | null;
  try {
    raw = s.getItem(HISTORY_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn("[nekoSudoku] history JSON invalid; resetting to empty");
    return [];
  }
  const res = historyEnvelopeSchema.safeParse(parsed);
  if (!res.success || res.data.schemaVersion !== HISTORY_SCHEMA_VERSION) {
    console.warn("[nekoSudoku] history schema mismatch; resetting to empty");
    return [];
  }
  return res.data.records;
}

function writeHistory(records: HistoryRecord[], store?: Storage): boolean {
  const s = getStore(store);
  if (!s) return false;
  const envelope = { schemaVersion: HISTORY_SCHEMA_VERSION, records };
  try {
    s.setItem(HISTORY_KEY, JSON.stringify(envelope));
    return true;
  } catch (err) {
    // §32: QuotaExceeded / Security errors must NOT crash the completion page.
    console.warn("[nekoSudoku] failed to persist history:", err);
    return false;
  }
}

/**
 * M3 §22 append a completed game to history EXACTLY ONCE (idempotent by gameId). Safe to call
 * repeatedly on completion rerenders / StrictMode / lifecycle events. Never throws; a write
 * failure is swallowed (logged) so it cannot crash the completion flow.
 * Returns true if a new record was written, false if it was a duplicate / write failed.
 */
export function appendHistoryOnce(record: HistoryRecord, store?: Storage): boolean {
  // Validate the record shape defensively (never trust callers blindly).
  const parsed = historyRecordSchema.safeParse(record);
  if (!parsed.success) {
    console.warn("[nekoSudoku] refusing to append invalid history record", parsed.error.issues);
    return false;
  }
  const existing = loadHistory(store);
  if (existing.some((r) => r.gameId === parsed.data.gameId)) return false; // dedupe by gameId

  // newest-first, capped at HISTORY_LIMIT.
  const next = [parsed.data, ...existing].slice(0, HISTORY_LIMIT);
  return writeHistory(next, store);
}

export function clearHistory(store?: Storage): void {
  const s = getStore(store);
  if (!s) return;
  try {
    s.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}
