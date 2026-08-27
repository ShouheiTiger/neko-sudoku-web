// Shared logic-step model used by BOTH the Human Solver and the Hint Engine.
// A step is either a value placement or a set of candidate eliminations, always
// justified by candidates from the Candidate Engine (never userNotes, §19).
import type { Technique } from "../types.js";

/** A cell + digit that a technique proves can be eliminated as a candidate. */
export type Elimination = { cellIndex: number; digit: number };

/** A single deduction found by a technique. */
export type LogicStep = {
  technique: Technique;
  /** Cells the technique is "about" — used by Hint layer 1 to highlight a region. */
  focusCells: number[];
  /** Units (0..26 indices into ALL_UNITS) the technique reasons over, if any. */
  focusUnits: number[];
} & (
  | { kind: "placement"; cellIndex: number; digit: number }
  | { kind: "elimination"; eliminations: Elimination[] }
);

export const SINGLE_TECHNIQUES: ReadonlySet<Technique> = new Set<Technique>([
  "naked-single",
  "hidden-single",
]);
