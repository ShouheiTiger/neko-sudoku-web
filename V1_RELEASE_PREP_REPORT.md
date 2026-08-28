# V1 Release Prep Report — Neko Sudoku

- **Base (main / m3-complete)**: `e7e1827db4ac5048144a8b60e46e952edaa3aa7b`
- **Branch**: `feature/v1-release-prep`
- **App version**: `1.0.0` · **Puzzle bank version**: `v1`
- **Scope**: production puzzle bank (1200) + validation pipeline + single runtime loader +
  New/Restore/Completion integration + load-failure UX + cross-browser matrix + audits + docs.
  **No deployment / no PWA / no accounts / no cloud / no new gameplay.**

---

## 1. Production Puzzle Bank (1200)

Generated offline (`scripts/generate-puzzles.ts`, tsx), committed as lazy per-level JSON.

| Level | Count | maxRequiredTechnique distribution |
|---|---|---|
| L1 | 200 | naked-single ×200 |
| L2 | 300 | hidden-single ×300 |
| L3 | 400 | pointing-pair ×281, box-line-reduction ×68, pointing-triple ×51 |
| L4 | 300 | naked-pair ×161, hidden-pair ×84, pointing-triple ×43, naked-triple ×12 |
| **Total** | **1200** | — |

- **Difficulty decided by FROZEN solver/analyzer only** (`analyze().solvedAtLevel`), never clue count (§8/§10).
- **Uniqueness** proven by FROZEN machine validator `checkUniqueness` (DFS, §15.1).
- **Difficulty purity**: every L puzzle solves *exactly* at L (not at L-1).
- **Technique boundary (§11)**: `maxRequiredTechnique ∈ ALLOWED_TECHNIQUES[L]`; forbidden tiers
  (Hidden Triple / X-Wing / Swordfish / XY-Wing / Chains / guessing) impossible by construction.
- **Determinism**: base seed `20260828` + code version reproduces the identical bank.
- **Source/license**: self-generated; no external dataset, no attribution required.
- Detail: see `PUZZLE_BANK_GENERATION.md`.

## 2. Validation pipeline

`npm run validate:puzzles` (`scripts/validate-puzzles.ts`) validates all 1200 in one pass and
exits non-zero on any failure. Latest run:

```
L1=200 L2=300 L3=400 L4=300  Total=1200
Unique IDs=1200 (dup=0)  Unique puzzles=1200 (dup=0)  Unique solutions=1200 (dup=0)
Uniqueness=PASS  Human logic=PASS  Difficulty purity=PASS  Technique boundary=PASS
Counts=PASS  Failures=0  RESULT: PASS
```

Per-puzzle checks live in `src/data/bank/validate-core.ts` and are reused by the Vitest bank
suite so CLI and tests share identical logic.

## 3. Single Production Loader (§23)

`src/data/bank/loader.ts` is the ONLY loader/selector:
- **Lazy delivery (§21)**: each level is a separate dynamic-import chunk (Vite code-split); the
  1200 puzzles are never in the initial bundle.
- **Runtime schema validation (§24)** via Zod (`bankLevelSchema`).
- **Selection (§25/§26)**: excludes recent ids (`nekoSudoku.recentPuzzleIds`, bounded ring ≤ 40);
  relaxes oldest-first when all are recent so a game can always start.
- **By id** (`findPuzzleById`) for restore.
- Typed non-crashing failures: `network | invalid-json | invalid-schema | wrong-bank-version | empty`.

## 4. New / Restore / Completion integration (§28/§29)

- New Game now serves from the Production Bank (dev pool retained only as a legacy/migration
  fallback). `DifficultyPage` calls `prepareLevel()` (async load) then synchronous `startNewGame()`.
- **ActiveGame schema v2 → v3**: adds optional `puzzleSnapshot { puzzle, solution, bankVersion }`
  so gentle-error + completion validation survive a refresh WITHOUT loading the whole bank.
  Migrations `v1→v3` and `v2→v3` preserve puzzleId/difficulty/board/notes/undo/timer; legacy dev
  saves still load.
- **§14 solution red line intact**: `solution` is read ONLY by the store's gentle/completion
  adapter. Hint / solver / candidate engine contain zero solution reads (verified by grep + tests).
- **History exactly-once + M-1 semantics preserved**: completion writes one record, clears the
  activeGame; write-failure keeps it for retry.

## 5. Load-failure UX (§45)

Chunk 404 / invalid JSON / schema mismatch / wrong bankVersion / empty → gentle message
（“题目暂时没有准备好，请再试一次。”）with **重试 / 返回**. No white screen, no corrupt activeGame.

## 6. Release metadata & privacy audit

- `index.html`: `lang=zh-CN`, viewport, theme-color, description, title「猫咪数独 · Neko Sudoku」.
- Help footer shows `版本 1.0.0 · 题库 v1` (`src/lib/release.ts`).
- **No analytics / trackers / external network / web fonts** — src external-request scan: NONE.
- Secret scan (src/scripts/dist/config): NONE. Build path-leak scan (dist): NONE. No source maps.

## 7. Tests

- **Vitest: 211 passed** (166 M3 baseline preserved + 45 new).
  - `production-bank.test.ts` (5) — counts/uniqueness/shape + sampled full frozen validation + no grading fields.
  - `production-runtime.test.ts` (15) — loader selection/recent-avoidance, all 5 bank errors, production restore/completion, no-prepare bankError.
  - `storage-corruption.test.ts` (23) — §47 corruption matrix (invalid JSON / wrong schema / wrong shape / partial / array) across settings/activeGame/history/recent + SecurityError get/set + QuotaExceeded history retry.
  - `migration.test.ts` (+2) — v2→v3 migration.
- **Playwright: 45 passed** — full suite on Chromium 320 & 390; cross-browser smoke on
  Chromium-1440, **WebKit-390**, **Firefox-390** (core loop + refresh-persist + no-overflow).

## 8. Build / bundle

```
initial JS  index-*.js  308.18 kB │ gzip 95.29 kB   (< 200 KB ✅)
CSS         index-*.css  11.09 kB │ gzip  2.83 kB
lazy banks  l1 gzip 16.71 · l2 24.24 · l3 32.48 · l4 24.57 kB (loaded on demand, NOT initial)
```

`npm run release:check` = validate:puzzles → tsc → vitest → build, all green.

## 9. Known non-blocking items (documented, not fixed per scope)

- **npm audit**: high/critical findings are **dev-only** (vite/vitest/esbuild dev server), not in
  the production static bundle. `react-router`/`react-router-dom` moderate advisories are
  SSR-hydration + open-redirect via user-controlled navigation — **not exploitable** in this
  static SPA with no SSR and fixed internal routes. The fix requires a Router v6→v7 major
  migration, out of Release-Prep scope (§59). Backlog only.
- **CAT_ASSET_STATUS = PLACEHOLDER** — cat is emoji (🐱), decorative/aria-hidden. Product decision
  on final art pending; does not block the technical gate.
- **REAL_IOS_SAFARI_TEST / REAL_ANDROID_DEVICE_TEST = NOT_PERFORMED_BY_AGENT** — see
  `V1_MANUAL_DEVICE_QA_CHECKLIST.md`.

## 10. Frozen surfaces untouched

M0 Core (solver/candidate/hint/analyzer/unique-validator), M1 shell, M2 gameplay assistance, M3
cat/a11y/history — no logic changes. Integration was additive (new bank modules, schema v3
migration, loader, store adapter, UI load states).

---

RELEASE_PREP_SELF_CHECK = PASS
DEPLOYMENT_PERFORMED = NO
Awaiting Claude V1 Release-Prep Review.
