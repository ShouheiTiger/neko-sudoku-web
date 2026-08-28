// Offline Production Puzzle Bank GENERATOR (V1 Release Prep §6, §8, §9, §19).
//
// Runs under tsx (Node), NEVER in the browser. Deterministic: a fixed base seed +
// fixed code version reproduces the exact same bank. Difficulty is decided ONLY by the
// FROZEN Human Logic Solver/Analyzer (analyze().solvedAtLevel); the generator merely
// proposes candidates. Uniqueness is proven by the FROZEN machine validator
// (checkUniqueness, DFS) — the human solver never guesses.
//
//   npm run generate:puzzles            # all levels, default seed
//   npm run generate:puzzles -- --seed 12345
//
// Output: src/data/bank/l{1..4}.json  (committed release data).
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parsePuzzle, boardToString } from "../src/board.js";
import { checkUniqueness } from "../src/tools/unique-validator.js";
import { analyze } from "../src/difficulty/analyze.js";
import { getPeers } from "../src/grid.js";
import {
  BANK_VERSION,
  BANK_COUNTS,
  ALLOWED_TECHNIQUES,
  puzzleId,
  type ProductionPuzzle,
} from "../src/data/bank/format.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../src/data/bank");

/** Deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Build a random full solved grid via randomized DFS (machine, not human logic). */
function fullSolution(rnd: () => number): number[] {
  const grid = new Array<number>(81).fill(0);
  const fill = (pos: number): boolean => {
    if (pos === 81) return true;
    if (grid[pos] !== 0) return fill(pos + 1);
    const used = new Set<number>();
    for (const p of getPeers(pos)) if (grid[p] !== 0) used.add(grid[p]!);
    for (const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rnd)) {
      if (used.has(d)) continue;
      grid[pos] = d;
      if (fill(pos + 1)) return true;
      grid[pos] = 0;
    }
    return false;
  };
  fill(0);
  return grid;
}

function toStr(cells: number[]): string {
  return cells.map((v) => (v === 0 ? "0" : String(v))).join("");
}

/** Uniqueness via the FROZEN machine validator only. */
function isUnique(puzzleStr: string): boolean {
  const parsed = parsePuzzle(puzzleStr);
  if (!parsed.ok) return false;
  return checkUniqueness(parsed.board).status === "unique";
}

/**
 * Analyze a candidate puzzle with the FROZEN analyzer.
 * Returns the puzzle's true difficulty level + metrics, or null if unsolvable by human logic.
 */
function analyzeCandidate(puzzleStr: string) {
  const parsed = parsePuzzle(puzzleStr);
  if (!parsed.ok) return null;
  const res = analyze(parsed.board);
  if (!res.ok) return null;
  return { level: res.solvedAtLevel, analysis: res.analysis };
}

/**
 * Dig holes from a full solution to produce a candidate puzzle that is UNIQUE.
 * We remove cells in a random order, keeping a removal only if uniqueness is preserved.
 * `minGivens` bounds how sparse we allow the puzzle to get (harder → fewer givens tendency).
 */
function digUnique(solution: number[], rnd: () => number, minGivens: number): number[] {
  const cells = solution.slice();
  for (const idx of shuffle([...Array(81).keys()], rnd)) {
    const givens = cells.filter((v) => v !== 0).length;
    if (givens <= minGivens) break;
    const saved = cells[idx]!;
    if (saved === 0) continue;
    cells[idx] = 0;
    if (!isUnique(toStr(cells))) cells[idx] = saved; // revert if it created ambiguity
  }
  return cells;
}

/** Purity gate (§10): puzzle labeled level L iff analyze solves it exactly at L. */
function isPureFor(level: 1 | 2 | 3 | 4, puzzleStr: string) {
  const a = analyzeCandidate(puzzleStr);
  if (!a) return null;
  if (a.level !== level) return null; // difficulty purity: must solve exactly at L, not below
  if (!ALLOWED_TECHNIQUES[level].has(a.analysis.maxRequiredTechnique as never)) return null;
  return a;
}

/** minGivens heuristic per level (looser puzzles for higher levels). */
const MIN_GIVENS: Record<1 | 2 | 3 | 4, number> = { 1: 40, 2: 34, 3: 28, 4: 24 };

function generateLevel(level: 1 | 2 | 3 | 4, count: number, rnd: () => number): ProductionPuzzle[] {
  const out: ProductionPuzzle[] = [];
  const seenPuzzle = new Set<string>();
  const seenSolution = new Set<string>();
  let attempts = 0;
  const started = Date.now();
  while (out.length < count) {
    attempts++;
    const sol = fullSolution(rnd);
    const solStr = toStr(sol);
    // Try a few digs per solution to amortize the (cheap) full-grid generation.
    for (let tries = 0; tries < 6 && out.length < count; tries++) {
      const dug = digUnique(sol, rnd, MIN_GIVENS[level]);
      const puzzleStr = toStr(dug);
      if (puzzleStr === solStr) continue; // no holes dug
      if (seenPuzzle.has(puzzleStr)) continue;
      const pure = isPureFor(level, puzzleStr);
      if (!pure) continue;
      if (seenSolution.has(solStr)) continue; // unique solutions across the bank (§16)
      seenPuzzle.add(puzzleStr);
      seenSolution.add(solStr);
      out.push({
        id: puzzleId(level, out.length + 1),
        bankVersion: BANK_VERSION,
        difficulty: level,
        puzzle: puzzleStr,
        solution: solStr,
        analysis: pure.analysis,
      });
      if (out.length % 25 === 0 || out.length === count) {
        const secs = ((Date.now() - started) / 1000).toFixed(0);
        console.log(`  L${level}: ${out.length}/${count}  (attempts=${attempts}, ${secs}s)`);
      }
    }
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const seedArg = args.indexOf("--seed");
  const baseSeed = seedArg >= 0 ? Number(args[seedArg + 1]) : 20260828;
  const onlyArg = args.indexOf("--level");
  const only = onlyArg >= 0 ? (Number(args[onlyArg + 1]) as 1 | 2 | 3 | 4) : null;
  const countArg = args.indexOf("--count");
  const countOverride = countArg >= 0 ? Number(args[countArg + 1]) : null;

  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Neko Sudoku bank generator — bankVersion=${BANK_VERSION}, baseSeed=${baseSeed}`);

  for (const level of [1, 2, 3, 4] as const) {
    if (only && level !== only) continue;
    // Per-level derived seed keeps levels independent yet fully reproducible.
    const rnd = mulberry32(baseSeed + level * 1_000_003);
    const count = countOverride ?? BANK_COUNTS[level];
    console.log(`Generating L${level} (${count})...`);
    const puzzles = generateLevel(level, count, rnd);
    if (args.includes("--dry")) {
      console.log(`  [dry] L${level}: ${puzzles.length} generated (not written)`);
      continue;
    }
    const file = resolve(OUT_DIR, `l${level}.json`);
    writeFileSync(
      file,
      JSON.stringify({ bankVersion: BANK_VERSION, difficulty: level, puzzles }, null, 0) + "\n",
    );
    console.log(`  wrote ${file} (${puzzles.length} puzzles)`);
  }
  console.log("Done. Run `npm run validate:puzzles` to verify.");
  // Silence unused import warning in some tsconfigs.
  void boardToString;
}

main();
