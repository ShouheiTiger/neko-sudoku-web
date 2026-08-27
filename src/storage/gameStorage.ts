// localStorage persistence for the active game (§20-§23).
// Save path: activeGame -> envelope -> JSON.stringify -> localStorage.
// Restore path: getItem -> JSON.parse -> Zod validate -> schemaVersion check -> board legality.
// On ANY failure we log a diagnostic, drop the corrupted entry, and return null (caller
// then redirects to home). We never `JSON.parse(...) as ActiveGame` (§22).
import { DEV_PUZZLES } from "../data/dev-puzzles.js";
import {
  activeGameSchema,
  envelopeSchema,
  SCHEMA_VERSION,
  type ActiveGame,
} from "./schemas.js";

export const ACTIVE_GAME_KEY = "nekoSudoku.activeGame";

type Storage = Pick<Window["localStorage"], "getItem" | "setItem" | "removeItem">;

function getStore(store?: Storage): Storage | null {
  if (store) return store;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Serialize + persist. Silently no-ops if storage is unavailable. */
export function saveActiveGame(game: ActiveGame, store?: Storage): void {
  const s = getStore(store);
  if (!s) return;
  const envelope = {
    schemaVersion: SCHEMA_VERSION,
    savedAt: Date.now(),
    data: game,
  };
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
 * Load + validate. Returns null (and clears the bad entry) on: missing, invalid JSON,
 * schema/version mismatch, illegal board, or unknown puzzleId (§23).
 */
export function loadActiveGame(store?: Storage): ActiveGame | null {
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

  const env = envelopeSchema.safeParse(parsed);
  if (!env.success) {
    // Fall back: maybe an older/bare shape; still validate against the game schema so we
    // never trust unvalidated data. If that also fails, drop.
    const bare = activeGameSchema.safeParse(parsed);
    if (!bare.success) return drop("schema-invalid", env.error.issues);
    return validateSemantics(bare.data, drop);
  }

  if (env.data.schemaVersion !== SCHEMA_VERSION) return drop("schema-version-mismatch");
  return validateSemantics(env.data.data, drop);
}

function validateSemantics(
  game: ActiveGame,
  drop: (reason: string, extra?: unknown) => null,
): ActiveGame | null {
  // puzzleId must exist in the known pool (§23).
  if (!DEV_PUZZLES.some((p) => p.id === game.puzzleId)) return drop("unknown-puzzle-id");
  // NOTE: we deliberately do NOT reject a board just because the user's in-progress
  // entries currently conflict. Under the "unchecked" error mode (Frozen Spec §37.2) a
  // player may legitimately have duplicate values mid-game, and §2.5 requires the game to
  // always be recoverable. Structural legality (81 cells, values 1..9|null) is already
  // enforced by the Zod board schema; transient rule conflicts are a normal game state,
  // not cache corruption, so they must survive a refresh.
  return game;
}
