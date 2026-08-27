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
  SCHEMA_VERSION,
  SETTINGS_SCHEMA_VERSION,
  type ActiveGame,
  type ActiveGameV1,
  type Settings,
  type ErrorMode,
} from "./schemas.js";

export const ACTIVE_GAME_KEY = "nekoSudoku.activeGame";
export const SETTINGS_KEY = "nekoSudoku.settings";

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

// ---------------- Settings (error mode, §13) ----------------

export const DEFAULT_ERROR_MODE: ErrorMode = "gentle";

export function saveSettings(settings: Settings, store?: Storage): void {
  const s = getStore(store);
  if (!s) return;
  try {
    s.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn("[nekoSudoku] failed to persist settings:", err);
  }
}

/** Load settings; on any corruption fall back to defaults (never throw). */
export function loadSettings(store?: Storage): Settings {
  const fallback: Settings = {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    errorMode: DEFAULT_ERROR_MODE,
  };
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
  const res = settingsSchema.safeParse(parsed);
  if (!res.success || res.data.schemaVersion !== SETTINGS_SCHEMA_VERSION) {
    console.warn("[nekoSudoku] settings schema mismatch; using defaults");
    return fallback;
  }
  return res.data;
}
