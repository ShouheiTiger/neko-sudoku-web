import { describe, it, expect } from "vitest";
import {
  createTimer,
  startTimer,
  pauseTimer,
  resumeTimer,
  completeTimer,
  elapsedMs,
  formatElapsed,
} from "../src/lib/timer.js";

// M2 §14/§26 timer state machine — pure functions with an injected clock (no real sleep).
describe("timer state machine (§14, §15, §26)", () => {
  it("start initializes and elapsed grows with the running span", () => {
    const t = startTimer(1000);
    expect(elapsedMs(t, 1000)).toBe(0);
    expect(elapsedMs(t, 6000)).toBe(5000); // 5s running
  });

  it("pause folds the active span; background time is excluded", () => {
    let t = startTimer(0);
    t = pauseTimer(t, 5000); // 5s active
    // 100s of background passes while paused
    expect(elapsedMs(t, 105000)).toBe(5000);
    t = resumeTimer(t, 105000);
    expect(elapsedMs(t, 110000)).toBe(10000); // +5s active = 10s total (bg excluded)
  });

  it("multiple pause/resume cycles accumulate only active time", () => {
    let t = startTimer(0);
    t = pauseTimer(t, 3000); // +3s
    t = resumeTimer(t, 20000); // 17s bg
    t = pauseTimer(t, 24000); // +4s
    t = resumeTimer(t, 100000); // 76s bg
    expect(elapsedMs(t, 102000)).toBe(3000 + 4000 + 2000); // 9s
  });

  it("resume is a no-op when already running (no double resume)", () => {
    const t = startTimer(0);
    const t2 = resumeTimer(t, 5000);
    expect(t2).toEqual(t); // unchanged
    expect(elapsedMs(t2, 6000)).toBe(6000);
  });

  it("pause is a no-op when already paused", () => {
    let t = startTimer(0);
    t = pauseTimer(t, 5000);
    const again = pauseTimer(t, 999999);
    expect(again).toEqual(t);
  });

  it("complete freezes elapsed; later time does not change it", () => {
    let t = startTimer(0);
    t = completeTimer(t, 8000);
    const done = elapsedMs(t, 8000);
    expect(done).toBe(8000);
    expect(elapsedMs(t, 999999)).toBe(8000); // frozen
  });

  it("createTimer is paused at zero", () => {
    const t = createTimer();
    expect(t.activeStartedAt).toBeNull();
    expect(elapsedMs(t, 123456)).toBe(0);
  });

  it("formatElapsed renders 分/秒", () => {
    expect(formatElapsed(0)).toBe("0秒");
    expect(formatElapsed(59000)).toBe("59秒");
    expect(formatElapsed(60000)).toBe("1分0秒");
    expect(formatElapsed(1112000)).toBe("18分32秒");
  });
});
