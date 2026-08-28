// Production Puzzle Bank VALIDATION pipeline (§17, §18). Runs under tsx (Node).
//
//   npm run validate:puzzles
//
// Validates ALL 1200 puzzles in one pass and prints the §18 report. Exits non-zero if any
// requirement fails (counts, unique ids/puzzles/solutions, uniqueness, human-logic solvable,
// difficulty purity, technique boundary, metadata consistency). Every logic check delegates
// to the FROZEN M0 core via validate-core.ts.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { BANK_COUNTS, BANK_TOTAL, BANK_VERSION, bankLevelSchema } from "../src/data/bank/format.js";
import { validatePuzzle, type PuzzleIssue } from "../src/data/bank/validate-core.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BANK_DIR = resolve(__dirname, "../src/data/bank");

function loadLevel(level: 1 | 2 | 3 | 4) {
  const file = resolve(BANK_DIR, `l${level}.json`);
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const parsed = bankLevelSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`L${level} file schema invalid: ${parsed.error.issues[0]?.message}`);
  }
  return parsed.data;
}

function main() {
  const issues: PuzzleIssue[] = [];
  const counts: Record<number, number> = {};
  const allIds = new Set<string>();
  const allPuzzles = new Set<string>();
  const allSolutions = new Set<string>();
  let dupIds = 0;
  let dupPuzzles = 0;
  let dupSolutions = 0;
  let total = 0;

  for (const level of [1, 2, 3, 4] as const) {
    const bank = loadLevel(level);
    counts[level] = bank.puzzles.length;
    total += bank.puzzles.length;
    for (const p of bank.puzzles) {
      if (allIds.has(p.id)) dupIds++;
      else allIds.add(p.id);
      if (allPuzzles.has(p.puzzle)) dupPuzzles++;
      else allPuzzles.add(p.puzzle);
      if (allSolutions.has(p.solution)) dupSolutions++;
      else allSolutions.add(p.solution);
      issues.push(...validatePuzzle(p, level));
    }
  }

  const countsOk =
    counts[1] === BANK_COUNTS[1] &&
    counts[2] === BANK_COUNTS[2] &&
    counts[3] === BANK_COUNTS[3] &&
    counts[4] === BANK_COUNTS[4] &&
    total === BANK_TOTAL;

  const uniqueOk = dupIds === 0 && dupPuzzles === 0 && dupSolutions === 0;
  const failures = issues.length;

  console.log("======================================================");
  console.log("Neko Sudoku — Production Bank Validation");
  console.log("======================================================");
  console.log(`Bank version        : ${BANK_VERSION}`);
  console.log(`L1 count            : ${counts[1]} (expect ${BANK_COUNTS[1]})`);
  console.log(`L2 count            : ${counts[2]} (expect ${BANK_COUNTS[2]})`);
  console.log(`L3 count            : ${counts[3]} (expect ${BANK_COUNTS[3]})`);
  console.log(`L4 count            : ${counts[4]} (expect ${BANK_COUNTS[4]})`);
  console.log(`Total               : ${total} (expect ${BANK_TOTAL})`);
  console.log(`Unique IDs          : ${allIds.size} (dup=${dupIds})`);
  console.log(`Unique puzzles      : ${allPuzzles.size} (dup=${dupPuzzles})`);
  console.log(`Unique solutions    : ${allSolutions.size} (dup=${dupSolutions})`);
  console.log(`Uniqueness (machine): ${issues.some((i) => i.problem.startsWith("uniqueness")) ? "FAIL" : "PASS"}`);
  console.log(`Human logic         : ${issues.some((i) => i.problem.includes("human logic")) ? "FAIL" : "PASS"}`);
  console.log(`Difficulty purity   : ${issues.some((i) => i.problem.includes("pure") || i.problem.includes("solves at")) ? "FAIL" : "PASS"}`);
  console.log(`Technique boundary  : ${issues.some((i) => i.problem.includes("not allowed")) ? "FAIL" : "PASS"}`);
  console.log(`Counts              : ${countsOk ? "PASS" : "FAIL"}`);
  console.log(`Failures            : ${failures}`);
  console.log("======================================================");

  if (failures > 0) {
    console.log("First failures:");
    for (const i of issues.slice(0, 25)) console.log(`  - ${i.id}: ${i.problem}`);
  }

  const ok = countsOk && uniqueOk && failures === 0;
  console.log(ok ? "RESULT: PASS" : "RESULT: FAIL");
  process.exit(ok ? 0 : 1);
}

main();
