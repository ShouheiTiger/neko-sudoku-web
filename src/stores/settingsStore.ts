// Minimal settings store placeholder (§5 recommended structure).
// M1 has no user-facing settings (no 大字模式/主题/声音 — Scope §27). This exists only so
// the app shell has a stable settings surface for later milestones. Kept intentionally empty
// of features to avoid building future functionality early.
import { create } from "zustand";

export type SettingsState = {
  // Reserved for future milestones (large-font, theme, etc.). Not used in M1.
};

export const useSettingsStore = create<SettingsState>(() => ({}));
