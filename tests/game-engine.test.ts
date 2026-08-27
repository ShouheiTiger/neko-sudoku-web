import { describe, it, expect } from "vitest";
import { parsePuzzle } from "../src/board.js";
import {
  setValue,
  clearValue,
  toggleNote,
  getConflicts,
  validateBoard,
  isCompleted,
} from "../src/game-engine.js";
import { EASY } from "./fixtures/golden.js";

const board = () => {
  const p = parsePuzzle(EASY.puzzle);
  if (!p.ok) throw new Error();
  return p.board;
};

describe("Game Engine pure fns + Result errors (§21-§22)", () => {
  it("setValue on given cell -> Result error, not throw", () => {
    const b = board();
    const givenIdx = b.findIndex((c) => c.given);
    const r = setValue(b, givenIdx, 1);
    expect(r).toEqual({ ok: false, reason: "given-cell" });
  });

  it("setValue invalid value -> Result error", () => {
    const b = board();
    const empty = b.findIndex((c) => c.value == null);
    expect(setValue(b, empty, 0)).toEqual({ ok: false, reason: "invalid-value" });
    expect(setValue(b, empty, 10)).toEqual({ ok: false, reason: "invalid-value" });
  });

  it("setValue is immutable and clears notes", () => {
    const b = board();
    const empty = b.findIndex((c) => c.value == null);
    b[empty]!.userNotes = [1, 2];
    const r = setValue(b, empty, 4);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.board[empty]!.value).toBe(4);
    expect(r.board[empty]!.userNotes).toEqual([]);
    expect(b[empty]!.value).toBe(null); // original untouched
  });

  it("clearValue works, given cell errors", () => {
    const b = board();
    const empty = b.findIndex((c) => c.value == null);
    const set = setValue(b, empty, 4);
    if (!set.ok) throw new Error();
    const cleared = clearValue(set.board, empty);
    expect(cleared.ok).toBe(true);
    if (cleared.ok) expect(cleared.board[empty]!.value).toBe(null);
  });

  it("toggleNote adds/removes and is UI-only", () => {
    const b = board();
    const empty = b.findIndex((c) => c.value == null);
    const a = toggleNote(b, empty, 7);
    if (!a.ok) throw new Error();
    expect(a.board[empty]!.userNotes).toEqual([7]);
    const c = toggleNote(a.board, empty, 7);
    if (!c.ok) throw new Error();
    expect(c.board[empty]!.userNotes).toEqual([]);
  });

  it("getConflicts detects duplicates; valid board has none", () => {
    const b = board();
    expect(getConflicts(b)).toEqual([]);
    const empty = b.findIndex((c) => c.value == null);
    // Force a conflict by copying a peer's value
    b[empty] = { given: false, value: 5, userNotes: [] }; // row0 already has 5
    expect(getConflicts(b).length).toBeGreaterThan(0);
  });

  it("isCompleted / validateBoard", () => {
    const b = board();
    expect(isCompleted(b)).toBe(false);
    expect(validateBoard(b).complete).toBe(false);
  });
});
