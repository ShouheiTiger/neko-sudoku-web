import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TutorialPage } from "../src/pages/TutorialPage/TutorialPage.js";
import { loadSettings } from "../src/storage/gameStorage.js";
import { useSettingsStore } from "../src/stores/settingsStore.js";

const ACTIVE_GAME_KEY = "nekoSudoku.activeGame";
const HISTORY_KEY = "nekoSudoku.history";

function renderTutorial() {
  return render(
    <MemoryRouter>
      <TutorialPage />
    </MemoryRouter>,
  );
}

describe("M3 Tutorial (§25/§26/§37/§40)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    useSettingsStore.setState({ errorMode: "gentle", largeText: false, tutorialSeen: false, hydrated: false });
  });
  afterEach(cleanup);

  it("shows 3 static rule screens then the interaction", () => {
    renderTutorial();
    expect(screen.getByTestId("tutorial-rule-0")).toBeTruthy();
    fireEvent.click(screen.getByTestId("tutorial-next"));
    expect(screen.getByTestId("tutorial-rule-1")).toBeTruthy();
    fireEvent.click(screen.getByTestId("tutorial-next"));
    expect(screen.getByTestId("tutorial-rule-2")).toBeTruthy();
    fireEvent.click(screen.getByTestId("tutorial-next"));
    expect(screen.getByTestId("tutorial-interaction")).toBeTruthy();
  });

  it("interaction expects 5 — wrong answer does not complete", () => {
    renderTutorial();
    fireEvent.click(screen.getByTestId("tutorial-next"));
    fireEvent.click(screen.getByTestId("tutorial-next"));
    fireEvent.click(screen.getByTestId("tutorial-next"));
    fireEvent.click(screen.getByTestId("tutorial-pick-3"));
    expect(screen.getByTestId("tutorial-wrong")).toBeTruthy();
    expect(screen.queryByTestId("tutorial-done")).toBeNull();
  });

  it("selecting 5 completes and marks tutorialSeen", () => {
    renderTutorial();
    fireEvent.click(screen.getByTestId("tutorial-next"));
    fireEvent.click(screen.getByTestId("tutorial-next"));
    fireEvent.click(screen.getByTestId("tutorial-next"));
    fireEvent.click(screen.getByTestId("tutorial-pick-5"));
    expect(screen.getByTestId("tutorial-done")).toBeTruthy();
    fireEvent.click(screen.getByTestId("tutorial-finish"));
    expect(loadSettings().tutorialSeen).toBe(true);
  });

  it("is skippable and skip marks tutorialSeen", () => {
    renderTutorial();
    fireEvent.click(screen.getByTestId("tutorial-skip"));
    expect(loadSettings().tutorialSeen).toBe(true);
  });

  it("does NOT create activeGame, history, or a timer", () => {
    renderTutorial();
    fireEvent.click(screen.getByTestId("tutorial-next"));
    fireEvent.click(screen.getByTestId("tutorial-next"));
    fireEvent.click(screen.getByTestId("tutorial-next"));
    fireEvent.click(screen.getByTestId("tutorial-pick-5"));
    fireEvent.click(screen.getByTestId("tutorial-finish"));
    expect(window.localStorage.getItem(ACTIVE_GAME_KEY)).toBeNull();
    expect(window.localStorage.getItem(HISTORY_KEY)).toBeNull();
  });
});
