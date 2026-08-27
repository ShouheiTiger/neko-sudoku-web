import { describe, it, expect } from "vitest";
import { parsePuzzle } from "../src/board.js";
import { analyze } from "../src/difficulty/analyze.js";
import { getHint } from "../src/hint-engine/hint-engine.js";
import { TECHNIQUE_TIER } from "../src/human-solver/solver.js";
import type { Technique } from "../src/types.js";
import { EASY, LOCKED } from "./fixtures/golden.js";

describe("Difficulty Analysis (§10-§14)", () => {
  it("EASY analysis reports single-based metrics", () => {
    const p = parsePuzzle(EASY.puzzle);
    if (!p.ok) throw new Error();
    const r = analyze(p.board);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.analysis.totalSteps).toBeGreaterThan(0);
    expect(r.analysis.maxRequiredTechnique).toBeDefined();
    // metrics from §12 are all present and non-negative
    expect(r.analysis.nonSingleSteps).toBeGreaterThanOrEqual(0);
    expect(r.analysis.candidateEliminations).toBeGreaterThanOrEqual(0);
  });

  it("LOCKED requires a non-single technique (pointing-pair) at L3", () => {
    const p = parsePuzzle(LOCKED.puzzle);
    if (!p.ok) throw new Error();
    const r = analyze(p.board);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.solvedAtLevel).toBe(3);
    expect(r.analysis.maxRequiredTechnique).toBe("pointing-pair");
    expect(r.analysis.nonSingleSteps).toBeGreaterThan(0);
    expect(r.analysis.candidateEliminations).toBeGreaterThan(0);
  });
});

describe("Hint layers (§24)", () => {
  it("returns layer 1/2/3 with escalating payload", () => {
    const p = parsePuzzle(EASY.puzzle);
    if (!p.ok) throw new Error();
    const h1 = getHint(p.board, 2, 1);
    const h2 = getHint(p.board, 2, 2);
    const h3 = getHint(p.board, 2, 3);
    expect(h1.available && h1.hint.layer === 1).toBe(true);
    expect(h2.available && h2.hint.layer === 2).toBe(true);
    expect(h3.available && h3.hint.layer === 3).toBe(true);
    if (h3.available && h3.hint.layer === 3) expect(h3.hint.fill).not.toBeNull();
  });

  it("solved board -> no hint available", () => {
    const p = parsePuzzle(EASY.solution);
    if (!p.ok) throw new Error();
    // solution string has no zeros, so all given/filled
    expect(getHint(p.board, 2, 1).available).toBe(false);
  });
});

describe("§0/§9 SCOPE GUARDRAIL — no L5/L6 techniques implemented", () => {
  const V1_ALLOWED: Technique[] = [
    "naked-single",
    "hidden-single",
    "locked-candidate",
    "pointing-pair",
    "pointing-triple",
    "box-line-reduction",
    "naked-pair",
    "hidden-pair",
    "naked-triple",
  ];

  it("technique tier contains only V1-allowed techniques, none above L4", () => {
    for (const t of TECHNIQUE_TIER) {
      expect(V1_ALLOWED).toContain(t.technique);
      expect(t.minLevel).toBeLessThanOrEqual(4);
    }
  });

  it("no forbidden technique names appear in the tier", () => {
    const forbidden = ["x-wing", "swordfish", "xy-wing", "chain", "coloring", "hidden-triple"];
    const names = TECHNIQUE_TIER.map((t) => t.technique.toLowerCase());
    for (const f of forbidden) expect(names.some((n) => n.includes(f))).toBe(false);
  });
});
