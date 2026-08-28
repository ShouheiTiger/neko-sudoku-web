// §23 Single Production Puzzle Loader. The ONLY place that loads production bank data,
// validates it, and selects puzzles. Home / New / Restore all go through this — no duplicated
// loading logic elsewhere (§23).
//
// Delivery (§21): each level is a separate JSON asset lazily imported on demand, so the 1200
// puzzles are NEVER in the initial JS bundle. Vite code-splits each dynamic import into its own
// chunk. Runtime does lightweight Zod validation (§24); full human-logic validation only runs
// offline in validate:puzzles (§24).
import {
  bankLevelSchema,
  BANK_VERSION,
  type ProductionPuzzle,
  type BankLevel,
} from "./format.js";
import {
  loadRecentPuzzleIds,
  pushRecentPuzzleId,
} from "../../storage/gameStorage.js";

export type BankLoadFailure =
  | "network"
  | "invalid-json"
  | "invalid-schema"
  | "wrong-bank-version"
  | "empty";

export type LoadResult =
  | { ok: true; level: BankLevel }
  | { ok: false; reason: BankLoadFailure };

export type Level = 1 | 2 | 3 | 4;

// In-memory cache of validated level data (per session). This is NOT localStorage — we never
// copy the whole bank into localStorage (§27). At most 4 level arrays live in memory.
const cache = new Map<Level, BankLevel>();

// Injectable importer so tests can supply fixtures / simulate failures without real chunks.
type Importer = (level: Level) => Promise<unknown>;

// Static per-level dynamic imports so Vite can code-split each level into its own lazy chunk
// (§21). resolveJsonModule provides the default export as the parsed object.
const defaultImporter: Importer = (level) => {
  switch (level) {
    case 1:
      return import("./l1.json").then((m) => m.default);
    case 2:
      return import("./l2.json").then((m) => m.default);
    case 3:
      return import("./l3.json").then((m) => m.default);
    case 4:
      return import("./l4.json").then((m) => m.default);
  }
};

let importer: Importer = defaultImporter;

export function __setBankImporterForTests(fn: Importer | null): void {
  importer = fn ?? defaultImporter;
  cache.clear();
}

/** Load + validate a level bank. Never throws; returns a typed failure the UI can handle (§45). */
export async function loadLevel(level: Level): Promise<LoadResult> {
  const cached = cache.get(level);
  if (cached) return { ok: true, level: cached };

  let raw: unknown;
  try {
    raw = await importer(level);
  } catch {
    return { ok: false, reason: "network" };
  }
  if (raw == null) return { ok: false, reason: "invalid-json" };

  const parsed = bankLevelSchema.safeParse(raw);
  if (!parsed.success) {
    // Distinguish a bad bankVersion from a general schema mismatch for clearer diagnostics.
    const bv = (raw as { bankVersion?: unknown }).bankVersion;
    if (bv !== undefined && bv !== BANK_VERSION) return { ok: false, reason: "wrong-bank-version" };
    return { ok: false, reason: "invalid-schema" };
  }
  if (parsed.data.difficulty !== level) return { ok: false, reason: "invalid-schema" };
  if (parsed.data.puzzles.length === 0) return { ok: false, reason: "empty" };

  cache.set(level, parsed.data);
  return { ok: true, level: parsed.data };
}

/** Find a specific puzzle by id within an already-loaded level (used on restore, §66). */
export async function findPuzzleById(id: string): Promise<ProductionPuzzle | null> {
  const m = /^v1-l([1-4])-\d{4}$/.exec(id);
  if (!m) return null;
  const level = Number(m[1]) as Level;
  const res = await loadLevel(level);
  if (!res.ok) return null;
  return res.level.puzzles.find((p) => p.id === id) ?? null;
}

export type SelectResult =
  | { ok: true; puzzle: ProductionPuzzle }
  | { ok: false; reason: BankLoadFailure };

/**
 * §25/§26 Select the next puzzle for a level from the Production Bank ONLY.
 * - excludes recently served ids when alternatives exist;
 * - if EVERY candidate is recent, relaxes to the least-recently-served (oldest-first) so a
 *   game can always start (never blocks);
 * - records the served id in the bounded recent list.
 * `rnd` is injectable for deterministic tests (default Math.random).
 */
export async function selectNextPuzzle(
  level: Level,
  rnd: () => number = Math.random,
): Promise<SelectResult> {
  const res = await loadLevel(level);
  if (!res.ok) return { ok: false, reason: res.reason };
  return { ok: true, puzzle: selectFrom(res.level.puzzles, rnd) };
}

/** True once a level's bank has been loaded + validated into the in-memory cache. */
export function isLevelLoaded(level: Level): boolean {
  return cache.has(level);
}

/**
 * Synchronous selection from an ALREADY-LOADED level (see loadLevel/selectNextPuzzle).
 * Returns null if the level is not cached yet. Applies the same recent-avoidance + relaxation
 * and records the served id. Used by the store's synchronous startNewGame after prepareLevel().
 */
export function selectLoaded(
  level: Level,
  rnd: () => number = Math.random,
): ProductionPuzzle | null {
  const bank = cache.get(level);
  if (!bank) return null;
  return selectFrom(bank.puzzles, rnd);
}

function selectFrom(puzzles: ProductionPuzzle[], rnd: () => number): ProductionPuzzle {
  const recent = new Set(loadRecentPuzzleIds());
  const fresh = puzzles.filter((p) => !recent.has(p.id));

  let chosen: ProductionPuzzle;
  if (fresh.length > 0) {
    chosen = fresh[Math.floor(rnd() * fresh.length)] ?? fresh[0]!;
  } else {
    // All candidates are recent → relax oldest-first: prefer the puzzle whose id is deepest
    // (or absent) in the newest-first recent list.
    const recentOrder = loadRecentPuzzleIds(); // newest-first
    const oldestFirst = [...puzzles].sort(
      (a, b) => recentOrder.indexOf(b.id) - recentOrder.indexOf(a.id),
    );
    chosen = oldestFirst[0] ?? puzzles[0]!;
  }
  pushRecentPuzzleId(chosen.id);
  return chosen;
}
