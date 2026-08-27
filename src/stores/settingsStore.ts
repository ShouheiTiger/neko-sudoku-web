// M3 settings store (§13/§14/§33). Single global source for user preferences:
//   - errorMode (M2 gentle/unchecked — persisted shape unchanged, still nekoSudoku.settings)
//   - largeText (M3 §15/§33 — applied instantly via a root data attribute, no reload)
//   - tutorialSeen (M3 §26)
//
// Persistence reuses the existing loadSettings/saveSettings (nekoSudoku.settings). We do NOT
// create a second settings storage. errorMode stays mirrored into the frozen gameStore so the
// M2 gameplay logic keeps its single runtime source; changing it here delegates to gameStore.
import { create } from "zustand";
import { loadSettings, saveSettings } from "../storage/gameStorage.js";
import type { ErrorMode, Settings } from "../storage/schemas.js";
import { useGameStore } from "./gameStore.js";

const LARGE_TEXT_ATTR = "data-large-text";

/** Apply/remove the root large-text flag so CSS variables switch globally (§33). */
export function applyLargeText(on: boolean): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (on) root.setAttribute(LARGE_TEXT_ATTR, "true");
  else root.removeAttribute(LARGE_TEXT_ATTR);
}

export type SettingsState = {
  errorMode: ErrorMode;
  largeText: boolean;
  tutorialSeen: boolean;
  hydrated: boolean;

  /** Load persisted settings into the store and apply side-effects (large-text root). */
  hydrate: () => void;
  setErrorMode: (mode: ErrorMode) => void;
  setLargeText: (on: boolean) => void;
  markTutorialSeen: () => void;
};

function persist(next: Settings): void {
  saveSettings(next);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  errorMode: "gentle",
  largeText: false,
  tutorialSeen: false,
  hydrated: false,

  hydrate: () => {
    const s = loadSettings();
    applyLargeText(s.largeText);
    set({
      errorMode: s.errorMode,
      largeText: s.largeText,
      tutorialSeen: s.tutorialSeen,
      hydrated: true,
    });
  },

  setErrorMode: (mode) => {
    // Delegate to the frozen gameStore so its runtime errorMode stays the single source and
    // the persisted settings are updated there (preserving largeText/tutorialSeen).
    useGameStore.getState().setErrorMode(mode);
    set({ errorMode: mode });
  },

  setLargeText: (on) => {
    applyLargeText(on); // instant, no reload (§33)
    const current = loadSettings();
    persist({ ...current, largeText: on });
    set({ largeText: on });
  },

  markTutorialSeen: () => {
    if (get().tutorialSeen) return;
    const current = loadSettings();
    persist({ ...current, tutorialSeen: true });
    set({ tutorialSeen: true });
  },
}));
