// §23-§26 HINT ENGINE. 3 layers (§24). Finds the next understandable logic step for
// the CURRENT board — never peeks at the solution string (§23), never at userNotes (§19).
//
// It obtains the next step from the SAME primitive the Solver uses (findNextStep),
// which seeds candidates from the Candidate Engine (§17/§26). This guarantees the
// consistency the spec's integration test demands (§26).
import type { BoardState, Difficulty } from "../types.js";
import { findNextStep } from "../human-solver/solver.js";
import { levelForDifficulty } from "../human-solver/solver.js";
import type { LogicStep } from "../human-solver/logic-step.js";
import { rowOf, colOf, boxOf } from "../grid.js";

export type HintLayer1 = {
  layer: 1;
  step: LogicStep;
  /** Region to highlight: a unit (row/col/box) or the focus cells. */
  focusUnits: number[];
  focusCells: number[];
  message: string;
};
export type HintLayer2 = { layer: 2; step: LogicStep; message: string };
export type HintLayer3 = {
  layer: 3;
  step: LogicStep;
  /** Only present for placement steps: the cell + digit to fill (§24 Hint 3). */
  fill: { cellIndex: number; digit: number } | null;
  message: string;
};
export type Hint = HintLayer1 | HintLayer2 | HintLayer3;

export type HintResult =
  | { available: true; hint: Hint }
  | { available: false; reason: "solved" | "stuck" };

const zh = (r: number, c: number) => `第${r + 1}行第${c + 1}列`;

function regionName(step: LogicStep): string {
  const cell = step.focusCells[0];
  if (cell == null) return "这个区域";
  const b = boxOf(cell);
  const names = ["左上", "上中", "右上", "左中", "正中", "右中", "左下", "下中", "右下"];
  return `${names[b]}的小方块`;
}

function describeLogic(step: LogicStep): string {
  if (step.kind === "placement") {
    const r = rowOf(step.cellIndex);
    const c = colOf(step.cellIndex);
    if (step.technique === "naked-single") {
      return `${zh(r, c)}只剩一个可能，所以这里可以确定是 ${step.digit}。`;
    }
    return `在它所在的区域里，只有${zh(r, c)}能放 ${step.digit}，所以这里就是 ${step.digit}。`;
  }
  // elimination
  const e = step.eliminations[0]!;
  return `根据${regionName(step)}的排布，${zh(rowOf(e.cellIndex), colOf(e.cellIndex))}不可能是 ${e.digit}，可以先把它排除。`;
}

/**
 * §24 Layered hint. `layer` selects how much to reveal (1..3). The underlying step is
 * always the same; only the message/payload differ.
 */
export function getHint(
  board: BoardState,
  difficulty: Difficulty,
  layer: 1 | 2 | 3,
): HintResult {
  if (board.every((c) => c.value != null)) return { available: false, reason: "solved" };
  const maxLevel = levelForDifficulty(difficulty);
  const step = findNextStep(board, maxLevel);
  if (!step) return { available: false, reason: "stuck" };

  if (layer === 1) {
    return {
      available: true,
      hint: {
        layer: 1,
        step,
        focusUnits: step.focusUnits,
        focusCells: step.focusCells,
        message: `先看看${regionName(step)}。`,
      },
    };
  }
  if (layer === 2) {
    return { available: true, hint: { layer: 2, step, message: describeLogic(step) } };
  }
  // layer 3 — tell the answer (§24 Hint 3). Only placements can be filled.
  const fill =
    step.kind === "placement" ? { cellIndex: step.cellIndex, digit: step.digit } : null;
  const message =
    fill != null
      ? `${zh(rowOf(fill.cellIndex), colOf(fill.cellIndex))}填 ${fill.digit}。`
      : `先按上一步排除候选，再看看会出现什么。`;
  return { available: true, hint: { layer: 3, step, fill, message } };
}
