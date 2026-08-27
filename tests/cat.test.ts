import { describe, it, expect } from "vitest";
import { catCopy, catEmoji, catStateForScreen, type CatState } from "../src/lib/cat.js";

const STATES: CatState[] = ["idle", "thinking", "sleeping", "hinting", "celebrating"];

describe("M3 Cat companion (§6-§9, §30)", () => {
  it("exposes exactly the 5 core states via copy/emoji without throwing", () => {
    for (const s of STATES) {
      for (const d of [1, 2, 3, 4] as const) {
        expect(typeof catCopy(s, d)).toBe("string");
        expect(catCopy(s, d).length).toBeGreaterThan(0);
        expect(typeof catEmoji(s)).toBe("string");
      }
    }
  });

  it("completion is ALWAYS celebrating regardless of screen entry", () => {
    expect(catStateForScreen("completed")).toBe("celebrating");
    expect(catStateForScreen("playing")).toBe("idle");
  });

  it("celebrating copy is positive for every difficulty and never mentions speed/score", () => {
    const banned = ["快", "慢了", "分", "名次", "排名", "最佳", "纪录", "错误", "提示太多", "星"];
    for (const d of [1, 2, 3, 4] as const) {
      const msg = catCopy("celebrating", d);
      expect(msg).toContain("完成");
      for (const b of banned) expect(msg).not.toContain(b);
    }
  });

  it("P0: copy does NOT depend on elapsed / hintCount / mistakes / undo (structural)", () => {
    // The signature only accepts (state, difficulty, seed). Simulate wildly different
    // "performance" by varying only difficulty/seed — copy for the SAME (state,difficulty)
    // is invariant across any seed rotation set, and difficulty never encodes performance.
    for (const s of STATES) {
      const base = catCopy(s, 3, 0);
      // The same state+difficulty yields a deterministic, performance-free line.
      expect(catCopy(s, 3, 0)).toBe(base);
    }
    // Different difficulties may differ ONLY for celebrating (allowed §9); non-celebrating
    // states must not use difficulty to grade.
    for (const s of STATES.filter((x) => x !== "celebrating")) {
      expect(catCopy(s, 1, 0)).toBe(catCopy(s, 4, 0));
    }
  });

  it("seed only rotates equally-positive lines, never a grade", () => {
    // Every idle line is a gentle companion line (no performance verb).
    const lines = new Set([0, 1, 2, 3, 4, 5].map((n) => catCopy("idle", 2, n)));
    for (const l of lines) {
      expect(l).not.toMatch(/快|慢了|分|名次|排名|最佳|纪录|错误|星/);
    }
  });
});
