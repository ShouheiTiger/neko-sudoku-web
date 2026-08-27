// L1-L4 technique finders. V1 allowed set ONLY (§11). No X-Wing/Swordfish/XY-Wing/
// Chains/Hidden-Triple (§9, §11). Every finder reads candidates supplied by the
// Candidate Engine — none computes its own candidate algorithm (§17).
import type { BoardState } from "../types.js";
import type { CandidateMap } from "../candidate-engine.js";
import type { LogicStep } from "./logic-step.js";
import { ALL_UNITS, ROW_UNITS, COL_UNITS, BOX_UNITS, rowOf, colOf, boxOf } from "../grid.js";

type Finder = (board: BoardState, cands: CandidateMap) => LogicStep | null;

const emptyCells = (cands: CandidateMap): number[] => [...cands.keys()];
const setOf = (cands: CandidateMap, i: number): ReadonlySet<number> =>
  cands.get(i) ?? new Set<number>();

const unitIndex = (unit: readonly number[]): number => ALL_UNITS.indexOf(unit);

// ---------- L1 ----------

/** Naked Single: a cell with exactly one candidate. */
export const nakedSingle: Finder = (_b, cands) => {
  for (const i of emptyCells(cands)) {
    const s = setOf(cands, i);
    if (s.size === 1) {
      const digit = [...s][0]!;
      return {
        technique: "naked-single",
        kind: "placement",
        cellIndex: i,
        digit,
        focusCells: [i],
        focusUnits: [],
      };
    }
  }
  return null;
};

// ---------- L2 ----------

/** Hidden Single: a digit that fits in only one cell of some unit. */
export const hiddenSingle: Finder = (_b, cands) => {
  for (const unit of ALL_UNITS) {
    for (let d = 1; d <= 9; d++) {
      const spots = unit.filter((i) => setOf(cands, i).has(d));
      if (spots.length === 1) {
        const i = spots[0]!;
        // Avoid reporting when it's also a naked single (naked-single runs first anyway).
        if (setOf(cands, i).size === 1) continue;
        return {
          technique: "hidden-single",
          kind: "placement",
          cellIndex: i,
          digit: d,
          focusCells: [i],
          focusUnits: [unitIndex(unit)],
        };
      }
    }
  }
  return null;
};

// ---------- L3: Locked Candidates ----------
// Pointing (box -> line) and Box-Line-Reduction (line -> box).

function collectEliminations(
  targets: readonly number[],
  d: number,
  cands: CandidateMap,
  exclude: ReadonlySet<number>,
): { cellIndex: number; digit: number }[] {
  const out: { cellIndex: number; digit: number }[] = [];
  for (const i of targets) {
    if (exclude.has(i)) continue;
    if (setOf(cands, i).has(d)) out.push({ cellIndex: i, digit: d });
  }
  return out;
}

/**
 * Pointing Pair / Pointing Triple: within a box, digit d is confined to a single
 * row (or col). Eliminate d from the rest of that row/col outside the box.
 */
export const pointing: Finder = (_b, cands) => {
  for (const box of BOX_UNITS) {
    for (let d = 1; d <= 9; d++) {
      const spots = box.filter((i) => setOf(cands, i).has(d));
      if (spots.length < 2 || spots.length > 3) continue;
      const rows = new Set(spots.map(rowOf));
      const cols = new Set(spots.map(colOf));
      const boxSet = new Set(box);
      if (rows.size === 1) {
        const line = ROW_UNITS[[...rows][0]!]!;
        const elim = collectEliminations(line, d, cands, boxSet);
        if (elim.length > 0) {
          return {
            technique: spots.length === 2 ? "pointing-pair" : "pointing-triple",
            kind: "elimination",
            eliminations: elim,
            focusCells: spots,
            focusUnits: [unitIndex(box), unitIndex(line)],
          };
        }
      }
      if (cols.size === 1) {
        const line = COL_UNITS[[...cols][0]!]!;
        const elim = collectEliminations(line, d, cands, boxSet);
        if (elim.length > 0) {
          return {
            technique: spots.length === 2 ? "pointing-pair" : "pointing-triple",
            kind: "elimination",
            eliminations: elim,
            focusCells: spots,
            focusUnits: [unitIndex(box), unitIndex(line)],
          };
        }
      }
    }
  }
  return null;
};

/**
 * Box-Line Reduction: within a row/col, digit d is confined to a single box.
 * Eliminate d from the rest of that box.
 */
export const boxLineReduction: Finder = (_b, cands) => {
  const lines = [...ROW_UNITS, ...COL_UNITS];
  for (const line of lines) {
    for (let d = 1; d <= 9; d++) {
      const spots = line.filter((i) => setOf(cands, i).has(d));
      if (spots.length < 2 || spots.length > 3) continue;
      const boxes = new Set(spots.map(boxOf));
      if (boxes.size !== 1) continue;
      const box = BOX_UNITS[[...boxes][0]!]!;
      const lineSet = new Set(line);
      const elim = collectEliminations(box, d, cands, lineSet);
      if (elim.length > 0) {
        return {
          technique: "box-line-reduction",
          kind: "elimination",
          eliminations: elim,
          focusCells: spots,
          focusUnits: [unitIndex(line), unitIndex(box)],
        };
      }
    }
  }
  return null;
};

// ---------- L4: subsets ----------

function combinations<T>(arr: T[], k: number): T[][] {
  const res: T[][] = [];
  const go = (start: number, combo: T[]) => {
    if (combo.length === k) {
      res.push(combo.slice());
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]!);
      go(i + 1, combo);
      combo.pop();
    }
  };
  go(0, []);
  return res;
}

/** Naked Pair / Naked Triple: n cells in a unit sharing exactly n candidates. */
function nakedSubset(size: 2 | 3): Finder {
  const tech = size === 2 ? "naked-pair" : "naked-triple";
  return (_b, cands) => {
    for (const unit of ALL_UNITS) {
      const cells = unit.filter((i) => {
        const s = setOf(cands, i);
        return s.size >= 2 && s.size <= size;
      });
      for (const combo of combinations(cells, size)) {
        const union = new Set<number>();
        for (const i of combo) for (const d of setOf(cands, i)) union.add(d);
        if (union.size !== size) continue;
        const comboSet = new Set(combo);
        const elim: { cellIndex: number; digit: number }[] = [];
        for (const i of unit) {
          if (comboSet.has(i)) continue;
          for (const d of union) if (setOf(cands, i).has(d)) elim.push({ cellIndex: i, digit: d });
        }
        if (elim.length > 0) {
          return {
            technique: tech,
            kind: "elimination",
            eliminations: elim,
            focusCells: combo,
            focusUnits: [unitIndex(unit)],
          };
        }
      }
    }
    return null;
  };
}

/** Hidden Pair: n digits confined to the same n cells in a unit; eliminate other digits from those cells. */
function hiddenSubset(size: 2): Finder {
  const tech = "hidden-pair";
  return (_b, cands) => {
    for (const unit of ALL_UNITS) {
      const digits: number[] = [];
      for (let d = 1; d <= 9; d++) {
        const spots = unit.filter((i) => setOf(cands, i).has(d));
        if (spots.length >= 2 && spots.length <= size) digits.push(d);
      }
      for (const combo of combinations(digits, size)) {
        const cellUnion = new Set<number>();
        for (const d of combo)
          for (const i of unit) if (setOf(cands, i).has(d)) cellUnion.add(i);
        if (cellUnion.size !== size) continue;
        const comboDigits = new Set(combo);
        const elim: { cellIndex: number; digit: number }[] = [];
        for (const i of cellUnion) {
          for (const d of setOf(cands, i))
            if (!comboDigits.has(d)) elim.push({ cellIndex: i, digit: d });
        }
        if (elim.length > 0) {
          return {
            technique: tech,
            kind: "elimination",
            eliminations: elim,
            focusCells: [...cellUnion],
            focusUnits: [unitIndex(unit)],
          };
        }
      }
    }
    return null;
  };
}

export const nakedPair = nakedSubset(2);
export const nakedTriple = nakedSubset(3);
export const hiddenPair = hiddenSubset(2);
