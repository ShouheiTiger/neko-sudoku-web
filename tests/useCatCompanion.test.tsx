import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCatCompanion } from "../src/hooks/useCatCompanion.js";

describe("M3 useCatCompanion state machine (§7/§8/§31)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("playing starts idle", () => {
    const { result } = renderHook(() => useCatCompanion("playing"));
    expect(result.current.state).toBe("idle");
  });

  it("completed pins celebrating", () => {
    const { result } = renderHook(() => useCatCompanion("completed"));
    expect(result.current.state).toBe("celebrating");
  });

  it("noteActivity → thinking, then returns to idle after the brief flash", () => {
    const { result } = renderHook(() => useCatCompanion("playing"));
    act(() => result.current.noteActivity());
    expect(result.current.state).toBe("thinking");
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.state).toBe("idle");
  });

  it("enterHinting → hinting and stays until next activity", () => {
    const { result } = renderHook(() => useCatCompanion("playing"));
    act(() => result.current.enterHinting());
    expect(result.current.state).toBe("hinting");
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.state).toBe("hinting"); // not overridden by a stray timer
  });

  it("sleeping after long inactivity (gentle, never a rebuke)", () => {
    const { result } = renderHook(() => useCatCompanion("playing"));
    act(() => vi.advanceTimersByTime(31_000));
    expect(result.current.state).toBe("sleeping");
  });

  it("activity wakes the cat back out of sleeping", () => {
    const { result } = renderHook(() => useCatCompanion("playing"));
    act(() => vi.advanceTimersByTime(31_000));
    expect(result.current.state).toBe("sleeping");
    act(() => result.current.noteActivity());
    expect(result.current.state).toBe("thinking");
  });
});
