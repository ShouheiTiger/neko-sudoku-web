import type { Difficulty } from "./cat.js";

// Shared V1 difficulty labels (§29). ONLY L1..L4 — never L5/L6 (Scope guardrail).
export const DIFFICULTY_NAME: Record<Difficulty, string> = {
  1: "初次见面",
  2: "轻松一下",
  3: "动动脑筋",
  4: "专心一下",
};

/** "L2 轻松一下" style label used in History (§29). */
export function difficultyLabel(d: Difficulty): string {
  return `L${d} ${DIFFICULTY_NAME[d]}`;
}
