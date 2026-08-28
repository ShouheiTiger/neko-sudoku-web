// M3 Cat Companion — PURE logic (§6-§11, §30). The cat is a COMPANION, never a judge.
//
// P0 red line (§30): copy/state selection MUST NOT branch on elapsed time, hintCount,
// directHintCount, mistakes, undo count, or completion speed. The only inputs allowed are
// the current `event`/state and `difficulty` (§9). This module intentionally has NO access
// to any of those forbidden signals — enforced by its function signatures.

export type CatState = "idle" | "thinking" | "sleeping" | "hinting" | "celebrating";
// `wake` is a very light transient transition (§7); represented at the UI layer only.

export type Difficulty = 1 | 2 | 3 | 4;

const IDLE_COPY = ["慢慢来呀。", "陪你一起想。", "不着急，慢慢来。"];
const THINKING_COPY = ["嗯……", "一起想想。"];
const SLEEPING_COPY = ["安静陪着你。"];
const HINTING_COPY = ["一起看看这里吧。", "我们一起看看。"];

// Celebration copy MAY vary by difficulty (§9/§24) — always positive, never speed/hint based.
const CELEBRATE_BY_DIFFICULTY: Record<Difficulty, string> = {
  1: "完成啦，真好。",
  2: "完成啦，节奏刚刚好。",
  3: "动了动脑筋，完成啦。",
  4: "这一局很需要耐心呢，完成啦。",
};

/**
 * Pick companion copy. `seed` (optional) only rotates among equally-positive lines for
 * variety — it is NOT derived from performance. Difficulty is used ONLY for celebration.
 */
export function catCopy(state: CatState, difficulty: Difficulty, seed = 0): string {
  switch (state) {
    case "idle":
      return IDLE_COPY[Math.abs(seed) % IDLE_COPY.length]!;
    case "thinking":
      return THINKING_COPY[Math.abs(seed) % THINKING_COPY.length]!;
    case "sleeping":
      return SLEEPING_COPY[0]!;
    case "hinting":
      return HINTING_COPY[Math.abs(seed) % HINTING_COPY.length]!;
    case "celebrating":
      return CELEBRATE_BY_DIFFICULTY[difficulty];
  }
}

/** Emoji placeholder art per state. Retained ONLY as a fallback if the WebP asset fails to
 *  load (§45 graceful degradation). Production render uses catAsset() below. Decorative only. */
export function catEmoji(state: CatState): string {
  switch (state) {
    case "sleeping":
      return "😴";
    case "thinking":
      return "🐱";
    case "hinting":
      return "🐱";
    case "celebrating":
      return "😺";
    case "idle":
    default:
      return "🐱";
  }
}

/**
 * Static state → final cat WebP asset mapping (V1 Cat Asset Integration). Local same-origin
 * assets under /cats (Vite publicDir), 512×512 transparent WebP. This is a pure lookup — it
 * does NOT read or influence the Cat state machine, copy, timing, or any hidden signal.
 */
export function catAsset(state: CatState): string {
  switch (state) {
    case "idle":
      return "/cats/cat-idle.webp";
    case "thinking":
      return "/cats/cat-thinking.webp";
    case "sleeping":
      return "/cats/cat-sleeping.webp";
    case "hinting":
      return "/cats/cat-hinting.webp";
    case "celebrating":
      return "/cats/cat-celebrating.webp";
  }
}

/** Default ephemeral state when (re)entering a screen (§10). No persistence. */
export function catStateForScreen(screen: "playing" | "completed"): CatState {
  return screen === "completed" ? "celebrating" : "idle";
}
