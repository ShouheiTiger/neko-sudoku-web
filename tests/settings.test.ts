import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadSettings,
  saveSettings,
  migrateSettingsV1ToV2,
  SETTINGS_KEY,
  DEFAULT_SETTINGS,
} from "../src/storage/gameStorage.js";
import { useSettingsStore, applyLargeText } from "../src/stores/settingsStore.js";
import { useGameStore } from "../src/stores/gameStore.js";

function reset() {
  window.localStorage.clear();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("data-large-text");
  useSettingsStore.setState({ errorMode: "gentle", largeText: false, tutorialSeen: false, hydrated: false });
}

describe("M3 Settings (§13/§14/§37)", () => {
  beforeEach(reset);
  afterEach(() => document.documentElement.removeAttribute("data-large-text"));

  it("largeText defaults to false and tutorialSeen to false", () => {
    const s = loadSettings();
    expect(s.largeText).toBe(false);
    expect(s.tutorialSeen).toBe(false);
    expect(s.errorMode).toBe("gentle");
  });

  it("toggle largeText persists and re-loads", () => {
    useSettingsStore.getState().hydrate();
    useSettingsStore.getState().setLargeText(true);
    expect(useSettingsStore.getState().largeText).toBe(true);
    expect(loadSettings().largeText).toBe(true);
    // fresh hydrate reflects persistence
    useSettingsStore.setState({ largeText: false });
    useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().largeText).toBe(true);
  });

  it("setLargeText applies the root data attribute instantly", () => {
    useSettingsStore.getState().hydrate();
    useSettingsStore.getState().setLargeText(true);
    expect(document.documentElement.getAttribute("data-large-text")).toBe("true");
    useSettingsStore.getState().setLargeText(false);
    expect(document.documentElement.hasAttribute("data-large-text")).toBe(false);
  });

  it("hydrate applies largeText attribute from persisted settings", () => {
    saveSettings({ ...DEFAULT_SETTINGS, largeText: true });
    useSettingsStore.getState().hydrate();
    expect(document.documentElement.getAttribute("data-large-text")).toBe("true");
  });

  it("migrates M2 v1 settings (errorMode only) to v2 with defaults; does not delete", () => {
    // Seed a v1 settings blob on disk.
    window.localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ schemaVersion: 1, errorMode: "unchecked" }),
    );
    const s = loadSettings();
    expect(s.schemaVersion).toBe(2);
    expect(s.errorMode).toBe("unchecked"); // preserved
    expect(s.largeText).toBe(false);
    expect(s.tutorialSeen).toBe(false);
    // migrated form is re-persisted as v2
    const raw = JSON.parse(window.localStorage.getItem(SETTINGS_KEY)!);
    expect(raw.schemaVersion).toBe(2);
  });

  it("migrateSettingsV1ToV2 helper preserves errorMode", () => {
    expect(migrateSettingsV1ToV2("unchecked")).toEqual({
      schemaVersion: 2,
      errorMode: "unchecked",
      largeText: false,
      tutorialSeen: false,
    });
  });

  it("corrupted settings JSON falls back to defaults without throwing", () => {
    window.localStorage.setItem(SETTINGS_KEY, "{not json");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const s = loadSettings();
    expect(s).toEqual(DEFAULT_SETTINGS);
  });

  it("errorMode change via settings store delegates to gameStore (M2 regression)", () => {
    useGameStore.setState({ errorMode: "gentle" });
    useSettingsStore.getState().hydrate();
    useSettingsStore.getState().setErrorMode("unchecked");
    expect(useGameStore.getState().errorMode).toBe("unchecked");
    expect(loadSettings().errorMode).toBe("unchecked");
    // largeText/tutorialSeen preserved through an errorMode change
    expect(loadSettings().largeText).toBe(false);
  });

  it("markTutorialSeen persists and is idempotent", () => {
    useSettingsStore.getState().hydrate();
    useSettingsStore.getState().markTutorialSeen();
    expect(loadSettings().tutorialSeen).toBe(true);
    useSettingsStore.getState().markTutorialSeen(); // no throw / no change
    expect(loadSettings().tutorialSeen).toBe(true);
  });

  it("applyLargeText is a no-op-safe DOM helper", () => {
    applyLargeText(true);
    expect(document.documentElement.getAttribute("data-large-text")).toBe("true");
    applyLargeText(false);
    expect(document.documentElement.hasAttribute("data-large-text")).toBe(false);
  });
});
