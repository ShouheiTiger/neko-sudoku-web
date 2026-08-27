# Neko Sudoku V1 — M0 Sudoku Core Technical Spike — Report

Single source of requirements: *Neko Sudoku V1 Frozen PRD & Technical Specification v2.0*.
Scope of this deliverable: **M0 only** — pure logic core + tests. **No UI / cats / theme / PWA.**

---

## 1. 实际修改文件清单 (files created)

Root: `/home/user/neko-sudoku-core/`

Config:
- `package.json` — TS + Vitest, no runtime deps.
- `tsconfig.json` — strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- `vitest.config.ts`

Source (`src/`):
- `types.ts` — §8/§12/§20/§36/§72 types (Difficulty, Technique, CellState, BoardState, PuzzleDefinition, GameAction, MoveResult).
- `grid.ts` — precomputed units (27) + peer tables, row/col/box helpers.
- `board.ts` — §73 parsePuzzle, findConflicts, cloneBoard, boardToString.
- `game-engine.ts` — §21/§22 setValue/clearValue/toggleNote/getConflicts/validateBoard/isCompleted (pure fns, Result errors).
- `candidate-engine.ts` — **§17/§18/§19 Candidate Engine** — getCandidates / getAllCandidates. The single logical-candidate source. Ignores userNotes.
- `human-solver/logic-step.ts` — shared LogicStep model (placement | elimination).
- `human-solver/techniques.ts` — L1–L4 finders only.
- `human-solver/working-candidates.ts` — mutable working grid seeded **from** the Candidate Engine.
- `human-solver/solver.ts` — §15.2 solver, tier table, findStep/findNextStep, analyze helpers.
- `hint-engine/hint-engine.ts` — §23–§26 3-layer hint, reuses findNextStep.
- `difficulty/analyze.ts` — §10–§14 DifficultyAnalysis from solve trace.
- `tools/unique-validator.ts` — §15.1 backtracking uniqueness validator (tooling).
- `index.ts` — public barrel.

Tests (`tests/`): `golden`, `candidate-engine`, `game-engine`, `solver`, `techniques`, `consistency`, `difficulty-hint-scope`, `fixtures/golden.ts`.

---

## 2. 架构说明 (architecture)

```
BoardState
   │
   ▼
Candidate Engine   ← single candidate algorithm (§17). Never reads userNotes (§19).
   │  getAllCandidates() seeds ↓
   ├────────────► Human Solver (working grid: placements + eliminations mutate it)
   └────────────► Hint Engine  (calls findNextStep → same seed)
```

- **P0 red line held:** neither Solver nor Hint has its own candidate algorithm. The working
  candidate grid used during a solve is *seeded exclusively* by `getAllCandidates` (Candidate
  Engine); eliminations then mutate that one grid. Hint calls the identical `findNextStep`.
- **Human logic vs machine verify separated (§15):** `tools/unique-validator.ts` uses
  backtracking and is the ONLY place guessing exists; the human solver never guesses.
- Game engine is pure and returns `MoveResult` for expected illegal ops (§22).

---

## 3. 测试结果 (test results)

`npx tsc --noEmit` → clean (strict).
`npx vitest run` → **7 files, 32 tests, all passing.**

Highlights:
- §26 consistency: Hint's next step == Solver's next step across full traces; Candidate
  Engine map == Solver working-grid seed; hint unaffected by bogus userNotes (§19).
- Solver solves EASY (singles) and LOCKED (requires pointing-pair, L3) to the unique solution.
- Uniqueness validator: unique puzzles unique, empty board → multiple.
- Scope guardrail test: technique tier contains only the 9 V1-allowed techniques, none
  above L4; asserts no x-wing/swordfish/xy-wing/chain/coloring/hidden-triple present.

Run: `cd /home/user/neko-sudoku-core && npm test`

---

## 4. 未完成事项 (not done — by design, out of M0)

- No UI, cats, theme, PWA, routing, localStorage/persistence, timer, tutorial, history.
- No puzzle bank / generator (spec §70–§72 production pipeline). Validator + analyzer exist
  so a generator can be built later, but generation itself is not M0.
- No L5/L6 techniques, no Difficulty 5/6 solver/hint/bank/UI (§0/§9 guardrail — intentionally absent).
- `box-line-reduction` finder implemented; `locked-candidate` is represented by the concrete
  `pointing-pair`/`pointing-triple`/`box-line-reduction` technique names (the union `locked-candidate`
  in §12 is a category, not emitted as a standalone step).

---

## 5. 与 Frozen Spec 的偏差 / 冲突 (deviations & conflicts — conservative choices)

1. **Monorepo layout (§75).** Spec *suggests* `apps/`+`packages/`+`tools/`. M0 uses a single
   package with mirrored subfolders (`src/human-solver`, `src/hint-engine`, `src/tools`) to keep
   the spike minimal. Module boundaries and the Candidate-Engine red line are preserved. This is
   the more conservative (smaller) implementation per your instruction; a later milestone can
   split into real packages without touching logic.

2. **Hidden Triple (§11).** Spec: "default NOT in required V1 scope unless the M0 spike proves
   cost/risk low." Decision: **excluded.** Naked Pair, Hidden Pair, Naked Triple already give a
   working L4; adding Hidden Triple is unnecessary for M0 and would widen scope. Conservative choice.

3. **`solution` field (§20 vs §72).** §20 says solution need not live in CellState; §72's
   PuzzleDefinition includes `solution`. No conflict — we keep the type as §72 and compute
   solutions via the validator in tooling. No solution peeking in Hint/Solver (§23).

4. **Elimination steps & candidate sourcing.** The spec's "candidates computed dynamically from
   board state" (§18/§19) describes the *base* computation. A human solver must accumulate
   eliminations across steps, which board *values* alone cannot express. Resolution: the working
   grid is **seeded** by the Candidate Engine (single algorithm) and then mutated by eliminations —
   both Solver and Hint use this same seeding path, so §17/§26 consistency is preserved and tested.
   This is an implementation clarification, not a scope change.

No product-definition changes were made. No V1.1 backlog items were implemented.
