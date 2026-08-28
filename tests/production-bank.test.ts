// §64 Production Bank tests. Loads the COMMITTED bank JSON via fs (Node) so the exact release
// data is exercised. Full counts/uniqueness/schema run over all 1200; the heavy human-logic
// validation runs over a representative sample here (the exhaustive gate is `validate:puzzles`).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { bankLevelSchema, BANK_COUNTS, BANK_TOTAL } from "../src/data/bank/format.js";
import { validatePuzzle } from "../src/data/bank/validate-core.js";

const LEVELS = [1, 2, 3, 4] as const;
function loadLevel(level: 1 | 2 | 3 | 4) {
  const raw = JSON.parse(
    readFileSync(resolve(process.cwd(), `src/data/bank/l${level}.json`), "utf8"),
  );
  const parsed = bankLevelSchema.safeParse(raw);
  expect(parsed.success, `l${level}.json schema`).toBe(true);
  return parsed.success ? parsed.data : null!;
}

describe("Production Bank — counts & shape (§64)", () => {
  const banks = Object.fromEntries(LEVELS.map((l) => [l, loadLevel(l)])) as Record<
    1 | 2 | 3 | 4,
    ReturnType<typeof loadLevel>
  >;

  it("per-level counts are 200/300/400/300 and total is 1200", () => {
    for (const l of LEVELS) expect(banks[l].puzzles.length).toBe(BANK_COUNTS[l]);
    const total = LEVELS.reduce((s, l) => s + banks[l].puzzles.length, 0);
    expect(total).toBe(BANK_TOTAL);
  });

  it("IDs, puzzle strings, and solution strings are all globally unique", () => {
    const ids = new Set<string>();
    const puzzles = new Set<string>();
    const solutions = new Set<string>();
    for (const l of LEVELS) {
      for (const p of banks[l].puzzles) {
        ids.add(p.id);
        puzzles.add(p.puzzle);
        solutions.add(p.solution);
      }
    }
    expect(ids.size).toBe(BANK_TOTAL);
    expect(puzzles.size).toBe(BANK_TOTAL);
    expect(solutions.size).toBe(BANK_TOTAL);
  });

  it("every puzzle carries the correct difficulty and bankVersion", () => {
    for (const l of LEVELS) {
      expect(banks[l].difficulty).toBe(l);
      for (const p of banks[l].puzzles) {
        expect(p.difficulty).toBe(l);
        expect(p.bankVersion).toBe("v1");
      }
    }
  });

  // Heavy logic validation over a representative, evenly-spread sample per level.
  it("sampled puzzles pass full frozen validation (unique/solvable/purity/boundary/metadata)", () => {
    for (const l of LEVELS) {
      const puzzles = banks[l].puzzles;
      const step = Math.max(1, Math.floor(puzzles.length / 12));
      for (let i = 0; i < puzzles.length; i += step) {
        const issues = validatePuzzle(puzzles[i]!, l);
        expect(issues, `${puzzles[i]!.id}: ${issues.map((x) => x.problem).join("; ")}`).toEqual([]);
      }
    }
  });

  it("stored analysis never leaks user-grading fields (§32)", () => {
    for (const l of LEVELS) {
      for (const p of banks[l].puzzles) {
        const keys = Object.keys(p.analysis).sort();
        expect(keys).toEqual(
          ["candidateEliminations", "maxRequiredTechnique", "nonSingleSteps", "totalSteps"].sort(),
        );
        for (const forbidden of ["score", "rating", "rank", "stars", "mistakes", "best"]) {
          expect(p).not.toHaveProperty(forbidden);
        }
      }
    }
  });
});
