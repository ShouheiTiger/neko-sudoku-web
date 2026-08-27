// Grid geometry helpers. Precomputed unit/peer tables. Row-major flat index (row*9+col).
import { UNIT } from "./types.js";

export const rowOf = (i: number): number => Math.floor(i / UNIT);
export const colOf = (i: number): number => i % UNIT;
export const boxOf = (i: number): number =>
  Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

export const indexOf = (row: number, col: number): number => row * UNIT + col;

function buildUnits(): number[][] {
  const units: number[][] = [];
  // rows
  for (let r = 0; r < UNIT; r++) {
    const u: number[] = [];
    for (let c = 0; c < UNIT; c++) u.push(indexOf(r, c));
    units.push(u);
  }
  // cols
  for (let c = 0; c < UNIT; c++) {
    const u: number[] = [];
    for (let r = 0; r < UNIT; r++) u.push(indexOf(r, c));
    units.push(u);
  }
  // boxes
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const u: number[] = [];
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++) u.push(indexOf(br * 3 + r, bc * 3 + c));
      units.push(u);
    }
  }
  return units;
}

/** All 27 units: 9 rows, then 9 cols, then 9 boxes. */
export const ALL_UNITS: readonly (readonly number[])[] = buildUnits();

export const ROW_UNITS = ALL_UNITS.slice(0, 9);
export const COL_UNITS = ALL_UNITS.slice(9, 18);
export const BOX_UNITS = ALL_UNITS.slice(18, 27);

function buildPeers(): number[][] {
  const peers: number[][] = [];
  for (let i = 0; i < UNIT * UNIT; i++) {
    const set = new Set<number>();
    for (const u of ALL_UNITS) {
      if (u.includes(i)) for (const j of u) if (j !== i) set.add(j);
    }
    peers.push([...set].sort((a, b) => a - b));
  }
  return peers;
}

/** For each cell, its 20 peers (same row/col/box, excluding itself). */
export const PEERS: readonly (readonly number[])[] = buildPeers();

export const getPeers = (i: number): readonly number[] => PEERS[i]!;

/** Units (as arrays of cell indices) that contain the given cell: [row, col, box]. */
export function unitsOf(i: number): readonly (readonly number[])[] {
  return [ROW_UNITS[rowOf(i)]!, COL_UNITS[colOf(i)]!, BOX_UNITS[boxOf(i)]!];
}
