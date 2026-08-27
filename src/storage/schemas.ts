// Zod schemas for persisted M1 state (§20, §22).
// These describe the ActiveGame envelope stored in localStorage. Runtime validation
// (never a bare `as ActiveGame`) protects against corrupted / stale caches (§22, §23).
import { z } from "zod";

export const SCHEMA_VERSION = 1;
export const ENGINE_VERSION = 1;

// Mirrors M0 CellState ({ given, value, userNotes }) exactly. userNotes stays for shape
// compatibility with the M0 BoardState type; M1 never writes notes (Scope §27).
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

// §11 ActiveGame — M1 keeps only the fields the core loop needs (no timer/undo/notes).
export const activeGameSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  gameId: z.string().min(1),
  puzzleId: z.string().min(1),
  difficulty: difficultySchema,
  board: boardSchema,
  selectedCell: z.number().int().min(0).max(80).nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
  engineVersion: z.number(),
});

export type ActiveGame = z.infer<typeof activeGameSchema>;

// §20 versioned envelope.
export const envelopeSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  savedAt: z.number(),
  data: activeGameSchema,
});

export type StoredEnvelope = z.infer<typeof envelopeSchema>;
