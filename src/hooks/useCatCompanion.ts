import { useEffect, useRef, useState, useCallback } from "react";
import type { CatState } from "../lib/cat.js";

// M3 §7/§8/§31 ephemeral cat state machine (UI-only, NOT persisted §10).
// Precedence while playing: celebrating > hinting > thinking(transient) > sleeping(idle) > idle.
// This hook owns ONLY presentation timing; it never reads elapsed/hint/mistake/undo (§30).

const THINKING_MS = 900; // brief "thinking" flash after an action, then back to idle
const SLEEP_AFTER_MS = 30_000; // long inactivity → sleeping (§8, gentle, never a rebuke)

export type CatController = {
  state: CatState;
  /** Call after a user gameplay action (select/input/note) → brief thinking, resets idle. */
  noteActivity: () => void;
  /** Call when the user opens a hint → hinting until dismissed/next activity. */
  enterHinting: () => void;
};

/**
 * @param screen "playing" | "completed" — completed pins celebrating (§10).
 * @param reducedMotion when true, timing still works but the UI disables animation.
 */
export function useCatCompanion(screen: "playing" | "completed"): CatController {
  const [state, setState] = useState<CatState>(
    screen === "completed" ? "celebrating" : "idle",
  );
  const thinkingTimer = useRef<number | null>(null);
  const sleepTimer = useRef<number | null>(null);
  const hinting = useRef(false);

  const clearTimers = () => {
    if (thinkingTimer.current != null) window.clearTimeout(thinkingTimer.current);
    if (sleepTimer.current != null) window.clearTimeout(sleepTimer.current);
    thinkingTimer.current = null;
    sleepTimer.current = null;
  };

  // Pin celebrating when completed; stop all timers.
  useEffect(() => {
    if (screen === "completed") {
      clearTimers();
      hinting.current = false;
      setState("celebrating");
    }
  }, [screen]);

  const armSleep = useCallback(() => {
    if (sleepTimer.current != null) window.clearTimeout(sleepTimer.current);
    // §31: don't run timers aggressively while hidden.
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    sleepTimer.current = window.setTimeout(() => {
      if (!hinting.current) setState("sleeping");
    }, SLEEP_AFTER_MS);
  }, []);

  const noteActivity = useCallback(() => {
    if (screen === "completed") return;
    hinting.current = false;
    setState("thinking");
    if (thinkingTimer.current != null) window.clearTimeout(thinkingTimer.current);
    thinkingTimer.current = window.setTimeout(() => {
      if (!hinting.current) setState("idle");
    }, THINKING_MS);
    armSleep();
  }, [screen, armSleep]);

  const enterHinting = useCallback(() => {
    if (screen === "completed") return;
    hinting.current = true;
    if (thinkingTimer.current != null) window.clearTimeout(thinkingTimer.current);
    setState("hinting");
    armSleep();
  }, [screen, armSleep]);

  // Arm the initial sleep timer on mount while playing.
  useEffect(() => {
    if (screen === "playing") armSleep();
    return clearTimers;
  }, [screen, armSleep]);

  return { state, noteActivity, enterHinting };
}
