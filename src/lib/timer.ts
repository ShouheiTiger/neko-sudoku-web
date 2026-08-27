// M2 §14/§15 Timer state machine — PURE functions over TimerState. No setInterval, no
// wall-clock accumulation loop: elapsed is always DERIVED from (accumulatedActiveMs +
// active span). `now` is injected so tests use fake timers / a fixed clock (§26).
import type { TimerState } from "../storage/schemas.js";

/** A fresh, not-yet-started timer. */
export function createTimer(): TimerState {
  return { activeStartedAt: null, accumulatedActiveMs: 0 };
}

/** Start (or restart) counting from `now`. Used when a new game begins (§14). */
export function startTimer(now: number): TimerState {
  return { activeStartedAt: now, accumulatedActiveMs: 0 };
}

/** Resume an already-created timer that is currently paused. No-op if already running. */
export function resumeTimer(t: TimerState, now: number): TimerState {
  if (t.activeStartedAt != null) return t; // already running → no double resume (§26)
  return { ...t, activeStartedAt: now };
}

/** Pause: fold the active span into accumulatedActiveMs. No-op if already paused. */
export function pauseTimer(t: TimerState, now: number): TimerState {
  if (t.activeStartedAt == null) return t; // already paused
  const span = Math.max(0, now - t.activeStartedAt);
  return { activeStartedAt: null, accumulatedActiveMs: t.accumulatedActiveMs + span };
}

/** Total active elapsed ms at `now` (running span included; excludes paused/background). */
export function elapsedMs(t: TimerState, now: number): number {
  const live = t.activeStartedAt == null ? 0 : Math.max(0, now - t.activeStartedAt);
  return t.accumulatedActiveMs + live;
}

/** Freeze the timer at completion: fold the final span and stop (§14). */
export function completeTimer(t: TimerState, now: number): TimerState {
  return pauseTimer(t, now);
}

/** Format ms as “X分Y秒” (completion page copy, §16). */
export function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}秒`;
  return `${m}分${s}秒`;
}
