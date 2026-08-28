// Zod schemas for persisted state.
// Runtime validation (never a bare `as ActiveGame`) protects against corrupted / stale
// caches (Frozen Spec §22, §23). M2 bumps the ActiveGame schema to v2 (adds noteMode,
// undoStack, hintCount, directHintCount, timer). A v1 schema is retained so we can migrate
// existing M1 saves forward instead of discarding them (M2 §24, §25).
import { z } from "zod";

export const SCHEMA_VERSION_V1 = 1;
export const SCHEMA_VERSION_V2 = 2; // M2 activeGame
export const SCHEMA_VERSION = 3; // current (V1 Release Prep — adds puzzleSnapshot)
export const SETTINGS_SCHEMA_VERSION_V1 = 1; // M2 settings (errorMode only)
export const SETTINGS_SCHEMA_VERSION = 2; // M3 settings (+largeText,+tutorialSeen)
export const HISTORY_SCHEMA_VERSION = 1; // M3 history
export const ENGINE_VERSION = 1;

/** Max history records retained (M3 §21). Chosen mid-range; documented in M3_REPORT.md. */
export const HISTORY_LIMIT = 150;

/** Max undo actions retained (M2 §9). Chosen mid-range; documented in M2_REPORT.md. */
export const UNDO_STACK_LIMIT = 150;

// Mirrors M0 CellState ({ given, value, userNotes }) exactly. userNotes is user data only —
// never a logical-candidate source (§4/§19).
export const cellStateSchema = z.object({
  given: z.boolean(),
  value: z.number().int().min(1).max(9).nullable(),
  userNotes: z.array(z.number().int().min(1).max(9)),
});

export const boardSchema = z.array(cellStateSchema).length(81);

export const difficultySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

// M2 §8 GameAction — before/after CellState snapshot per mutation.
export const gameActionSchema = z.object({
  type: z.union([
    z.literal("set-value"),
    z.literal("clear-value"),
    z.literal("toggle-note"),
    z.literal("hint-fill"),
  ]),
  cellIndex: z.number().int().min(0).max(80),
  before: cellStateSchema,
  after: cellStateSchema,
  timestamp: z.number(),
});
export type GameAction = z.infer<typeof gameActionSchema>;

// M2 §14 TimerState. No setInterval accumulation; elapsed is derived (see lib/timer.ts).
export const timerStateSchema = z.object({
  activeStartedAt: z.number().nullable(),
  accumulatedActiveMs: z.number().min(0),
});
export type TimerState = z.infer<typeof timerStateSchema>;

export const errorModeSchema = z.union([z.literal("gentle"), z.literal("unchecked")]);
export type ErrorMode = z.infer<typeof errorModeSchema>;

// ---- v1 ActiveGame (M1) — kept ONLY as a migration input shape ----
export const activeGameSchemaV1 = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION_V1),
  gameId: z.string().min(1),
  puzzleId: z.string().min(1),
  difficulty: difficultySchema,
  board: boardSchema,
  selectedCell: z.number().int().min(0).max(80).nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
  engineVersion: z.number(),
});
export type ActiveGameV1 = z.infer<typeof activeGameSchemaV1>;

// ---- v2 ActiveGame (M2) — kept as a migration input shape ----
export const activeGameSchemaV2 = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION_V2),
  gameId: z.string().min(1),
  puzzleId: z.string().min(1),
  difficulty: difficultySchema,
  board: boardSchema,
  selectedCell: z.number().int().min(0).max(80).nullable(),
  noteMode: z.boolean(),
  undoStack: z.array(gameActionSchema).max(UNDO_STACK_LIMIT),
  hintCount: z.number().int().min(0),
  directHintCount: z.number().int().min(0),
  timer: timerStateSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
  engineVersion: z.number(),
});
export type ActiveGameV2 = z.infer<typeof activeGameSchemaV2>;

/**
 * V1 Release Prep: a lightweight snapshot of the served production puzzle carried inside the
 * ActiveGame so gentle-error / completion validation survive a refresh WITHOUT loading the
 * whole bank (§28). Hint / solver / candidate engine MUST NEVER read `solution` (§14).
 */
export const puzzleSnapshotSchema = z.object({
  puzzle: z.string().length(81),
  solution: z.string().length(81),
  bankVersion: z.string().min(1),
});
export type PuzzleSnapshot = z.infer<typeof puzzleSnapshotSchema>;

// ---- v3 ActiveGame (V1 Release Prep, current) — adds optional puzzleSnapshot ----
export const activeGameSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  gameId: z.string().min(1),
  puzzleId: z.string().min(1),
  difficulty: difficultySchema,
  board: boardSchema,
  selectedCell: z.number().int().min(0).max(80).nullable(),
  noteMode: z.boolean(),
  undoStack: z.array(gameActionSchema).max(UNDO_STACK_LIMIT),
  hintCount: z.number().int().min(0),
  directHintCount: z.number().int().min(0),
  timer: timerStateSchema,
  // §28 optional; legacy dev games resolve the solution via a dev-pool fallback instead.
  puzzleSnapshot: puzzleSnapshotSchema.optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  engineVersion: z.number(),
});
export type ActiveGame = z.infer<typeof activeGameSchema>;

// §20 versioned envelope (v2).
export const envelopeSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  savedAt: z.number(),
  data: activeGameSchema,
});
export type StoredEnvelope = z.infer<typeof envelopeSchema>;

// v1 envelope shape, for migration input.
export const envelopeSchemaV1 = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION_V1),
  savedAt: z.number(),
  data: activeGameSchemaV1,
});

// v2 envelope shape, for migration input (M2 → v3).
export const envelopeSchemaV2 = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION_V2),
  savedAt: z.number(),
  data: activeGameSchemaV2,
});

// ---- Settings ----
// M2 v1 settings (errorMode only) — retained as a migration input shape (M3 §14).
export const settingsSchemaV1 = z.object({
  schemaVersion: z.literal(SETTINGS_SCHEMA_VERSION_V1),
  errorMode: errorModeSchema,
});
export type SettingsV1 = z.infer<typeof settingsSchemaV1>;

// M3 v2 settings (current): adds largeText + tutorialSeen. Persisted under nekoSudoku.settings.
export const settingsSchema = z.object({
  schemaVersion: z.literal(SETTINGS_SCHEMA_VERSION),
  errorMode: errorModeSchema,
  largeText: z.boolean(),
  tutorialSeen: z.boolean(),
});
export type Settings = z.infer<typeof settingsSchema>;

// ---- History (M3 §20-§23) ----
// Records ONLY date/difficulty/elapsed for display; gameId/puzzleId/completedAt are internal.
// NEVER stores score / mistakes / hintCount / rating / rank (§21/§23).
export const historyRecordSchema = z.object({
  gameId: z.string().min(1),
  puzzleId: z.string().min(1),
  difficulty: difficultySchema,
  completedAt: z.number(),
  elapsedMs: z.number().min(0),
});
export type HistoryRecord = z.infer<typeof historyRecordSchema>;

export const historyEnvelopeSchema = z.object({
  schemaVersion: z.literal(HISTORY_SCHEMA_VERSION),
  records: z.array(historyRecordSchema).max(HISTORY_LIMIT),
});
export type HistoryEnvelope = z.infer<typeof historyEnvelopeSchema>;
