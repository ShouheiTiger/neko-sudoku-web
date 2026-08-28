// localStorage persistence (§20-§23; M2 §13/§24/§25).
// Save path: activeGame -> envelope(v2) -> JSON.stringify -> localStorage.
// Restore path: getItem -> JSON.parse -> Zod validate (v2, else migrate v1) -> puzzleId check.
// On ANY failure we log a diagnostic, drop the corrupted entry, and return null (caller
// then redirects to home). We never `JSON.parse(...) as ActiveGame` (§22).
import { DEV_PUZZLES } from "../data/dev-puzzles.js";
import { startTimer } from "../lib/timer.js";
import { z } from "zod";
import {
  activeGameSchema,
  envelopeSchema,
  envelopeSchemaV1,
  envelopeSchemaV2,
  activeGameSchemaV1,
  activeGameSchemaV2,
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
  type ActiveGameV2,
  type Settings,
  type ErrorMode,
  type HistoryRecord,
} from "./schemas.js";

export const ACTIVE_GAME_KEY = "nekoSudoku.activeGame";
export const SETTINGS_KEY = "nekoSudoku.settings";
export const HISTORY_KEY = "nekoSudoku.history";
export const RECENT_PUZZLE_IDS_KEY = "nekoSudoku.recentPuzzleIds";

/** §26 Max recent puzzle ids remembered per selection avoidance. Bounded, never grows. */
export const RECENT_PUZZLE_LIMIT = 40;

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
 * Migrate a validated v1 ActiveGame (M1) to v3 with safe defaults. We do NOT delete old
 * saves. The v1 board has no timer info, so we start the timer at `now`. No puzzleSnapshot
 * (legacy dev games resolve their solution via the dev-pool fallback).
 */
export function migrateV1ToV3(v1: ActiveGameV1, now: number): ActiveGame {
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

/**
 * Migrate a validated v2 ActiveGame (M2/M3) to v3. All v2 gameplay fields are preserved
 * verbatim (§29: puzzleId/difficulty/board/notes/undo/timer). No puzzleSnapshot is added —
 * v2 games are dev-pool games whose solution resolves via the dev fallback.
 */
export function migrateV2ToV3(v2: ActiveGameV2, now: number): ActiveGame {
  return {
    schemaVersion: SCHEMA_VERSION,
    gameId: v2.gameId,
    puzzleId: v2.puzzleId,
    difficulty: v2.difficulty,
    board: v2.board,
    selectedCell: v2.selectedCell,
    noteMode: v2.noteMode,
    undoStack: v2.undoStack,
    hintCount: v2.hintCount,
    directHintCount: v2.directHintCount,
    timer: v2.timer,
    createdAt: v2.createdAt,
    updatedAt: now,
    engineVersion: v2.engineVersion,
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

  // 1) Current v3 envelope.
  const env = envelopeSchema.safeParse(parsed);
  if (env.success) return validateSemantics(env.data.data, drop);

  // 2) v2 envelope → migrate to v3.
  const envV2 = envelopeSchemaV2.safeParse(parsed);
  if (envV2.success) {
    const migrated = migrateV2ToV3(envV2.data.data, now);
    const ok = validateSemantics(migrated, drop);
    if (ok) saveActiveGame(ok, s);
    return ok;
  }

  // 3) v1 envelope → migrate to v3.
  const envV1 = envelopeSchemaV1.safeParse(parsed);
  if (envV1.success) {
    const migrated = migrateV1ToV3(envV1.data.data, now);
    const ok = validateSemantics(migrated, drop);
    if (ok) saveActiveGame(ok, s); // persist migrated form
    return ok;
  }

  // 4) Bare shapes (defensive): v3, then v2, then v1 → migrate.
  const bareV3 = activeGameSchema.safeParse(parsed);
  if (bareV3.success) return validateSemantics(bareV3.data, drop);

  const bareV2 = activeGameSchemaV2.safeParse(parsed);
  if (bareV2.success) {
    const migrated = migrateV2ToV3(bareV2.data, now);
    const ok = validateSemantics(migrated, drop);
    if (ok) saveActiveGame(ok, s);
    return ok;
  }

  const bareV1 = activeGameSchemaV1.safeParse(parsed);
  if (bareV1.success) {
    const migrated = migrateV1ToV3(bareV1.data, now);
    const ok = validateSemantics(migrated, drop);
    if (ok) saveActiveGame(ok, s);
    return ok;
  }

  return drop("schema-invalid", env.error.issues);
}

const PRODUCTION_ID_RE = /^v1-l[1-4]-\d{4}$/;

function validateSemantics(
  game: ActiveGame,
  drop: (reason: string, extra?: unknown) => null,
): ActiveGame | null {
  // §23/§28 A game is recognizable if it is a production puzzle (id pattern OR carries a
  // puzzleSnapshot for offline solution validation) OR a legacy dev puzzle (tests/migration
  // fallback). Otherwise the persisted id is unknown and we drop it.
  const isProduction = PRODUCTION_ID_RE.test(game.puzzleId) || game.puzzleSnapshot != null;
  const isDev = DEV_PUZZLES.some((p) => p.id === game.puzzleId);
  if (!isProduction && !isDev) return drop("unknown-puzzle-id");
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

/** M-1: explicit History write outcome so callers can distinguish duplicate from failure. */
export type HistoryAppendResult = "written" | "duplicate" | "failed";

/**
 * M3 §22 append a completed game to history EXACTLY ONCE (idempotent by gameId). Safe to call
 * repeatedly on completion rerenders / StrictMode / lifecycle events. Never throws.
 *
 * M-1 result contract (unambiguous, not a bare boolean):
 *   - "written"   : a NEW record was persisted this call.
 *   - "duplicate" : this gameId is already persisted → treat as already-saved (safe to clear
 *                   the completed activeGame; no second row is written).
 *   - "failed"    : the record was invalid OR the storage write failed (quota/security/etc).
 *                   The completed game is NOT persisted → caller MUST keep activeGame so the
 *                   completion can be retried on the next /play entry.
 */
export function appendHistoryOnce(record: HistoryRecord, store?: Storage): HistoryAppendResult {
  // Validate the record shape defensively (never trust callers blindly).
  const parsed = historyRecordSchema.safeParse(record);
  if (!parsed.success) {
    console.warn("[nekoSudoku] refusing to append invalid history record", parsed.error.issues);
    return "failed";
  }
  const existing = loadHistory(store);
  if (existing.some((r) => r.gameId === parsed.data.gameId)) return "duplicate"; // dedupe by gameId

  // newest-first, capped at HISTORY_LIMIT.
  const next = [parsed.data, ...existing].slice(0, HISTORY_LIMIT);
  return writeHistory(next, store) ? "written" : "failed";
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

// ---------------- Recent puzzle ids (§26) ----------------
// A bounded, newest-first list of recently served puzzle ids, used ONLY to avoid immediately
// repeating a puzzle. Never grows unbounded; corruption falls back to empty; write failure is
// swallowed (selection must never crash just because we couldn't remember the recent list).
const recentSchema = z.array(z.string().min(1));

export function loadRecentPuzzleIds(store?: Storage): string[] {
  const s = getStore(store);
  if (!s) return [];
  let raw: string | null = null;
  try {
    raw = s.getItem(RECENT_PUZZLE_IDS_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed = recentSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return [];
    return parsed.data.slice(0, RECENT_PUZZLE_LIMIT);
  } catch {
    return [];
  }
}

/** Record a served puzzle id (newest-first, deduped, bounded). Never throws. */
export function pushRecentPuzzleId(id: string, store?: Storage): void {
  const s = getStore(store);
  if (!s) return;
  const existing = loadRecentPuzzleIds(store).filter((x) => x !== id);
  const next = [id, ...existing].slice(0, RECENT_PUZZLE_LIMIT);
  try {
    s.setItem(RECENT_PUZZLE_IDS_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn("[nekoSudoku] failed to persist recent puzzle ids:", err);
  }
}

export function clearRecentPuzzleIds(store?: Storage): void {
  const s = getStore(store);
  if (!s) return;
  try {
    s.removeItem(RECENT_PUZZLE_IDS_KEY);
  } catch {
    /* ignore */
  }
}
