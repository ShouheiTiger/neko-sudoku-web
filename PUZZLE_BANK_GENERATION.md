# Puzzle Bank Generation — Neko Sudoku V1

How the committed production puzzle bank (`src/data/bank/l{1..4}.json`) is produced and re-verified.
The generator is a **development tool** (Node/tsx), never shipped to the browser (§6).

## Commands

```bash
npm run generate:puzzles          # regenerate all levels (default seed)
npm run generate:puzzles -- --seed 20260828
npm run generate:puzzles -- --level 4 --count 10 --dry   # smoke: generate, do not write
npm run validate:puzzles          # verify the committed bank (1200 puzzles)
```

`generate` and `validate` are intentionally separate (§20). The build never regenerates puzzles;
the committed JSON is the release data.

## Determinism / reproducibility (§19)

- PRNG: `mulberry32(baseSeed + level * 1_000_003)` — a fixed base seed + fixed code version
  reproduces the identical bank.
- **generator version**: `scripts/generate-puzzles.ts` @ this commit.
- **base seed**: `20260828` (default).
- **bank version**: `v1` (`BANK_VERSION` in `src/data/bank/format.ts`).

## Algorithm

1. **Full solution** — randomized DFS fills a complete, valid 9×9 grid (machine search only).
2. **Dig holes** — remove cells in random order; keep a removal only if the puzzle still has
   **exactly one solution** per the FROZEN machine validator `checkUniqueness` (DFS, §15.1).
   `minGivens` per level biases higher levels toward fewer givens.
3. **Difficulty purity gate (§10)** — the FROZEN analyzer `analyze()` decides the true level by
   the *minimum* human-logic level that solves it (`solvedAtLevel`). A candidate is accepted for
   level L **iff** `solvedAtLevel === L` (so L2/L3/L4 genuinely require that tier's new logic,
   never a mislabelled easier puzzle).
4. **Technique boundary (§11)** — `analysis.maxRequiredTechnique` must be within
   `ALLOWED_TECHNIQUES[L]`. Forbidden tiers (Hidden Triple / X-Wing / Swordfish / XY-Wing /
   Chains / Coloring / guessing) can never appear because the frozen solver does not implement
   them and the analyzer would report the puzzle unsolvable.
5. **Uniqueness across the bank (§16)** — puzzle strings and solution strings are de-duplicated.

The generator NEVER decides difficulty itself — clue count / weights / "looks hard" are not a
source of truth (§8). Only the frozen solver/analyzer decides.

## Source & license (§7)

- **Source**: self-generated offline using the project's own frozen Core + machine uniqueness
  validator. No external / commercial Sudoku dataset was downloaded or copied.
- **License / attribution**: none required (original generation).

## Difficulty distribution (informational, §12)

`maxRequiredTechnique` counts in the committed bank:

- **L1** (200): naked-single ×200.
- **L2** (300): hidden-single ×300.
- **L3** (400): pointing-pair ×281, box-line-reduction ×68, pointing-triple ×51.
- **L4** (300): naked-pair ×161, hidden-pair ×84, pointing-triple ×43, naked-triple ×12.

These metrics are for intra-level quality observation only — never shown to or used to grade the
player (§12/§32).
