import { test, expect } from "@playwright/test";

// M2 §27 E2E: Notes, Undo, Error Mode, Hint, Timer completion, refresh persistence.
// Runs on both viewports configured in playwright.config.ts (320×568 and 390×844).

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

async function startGame(page: import("@playwright/test").Page, diff = 1) {
  await page.goto("/");
  await page.getByRole("button", { name: "开始一局" }).click();
  await page.getByTestId(`difficulty-${diff}`).click();
  await expect(page).toHaveURL(/\/play$/);
}

async function firstEmpty(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem("nekoSudoku.activeGame");
    const data = JSON.parse(raw!).data;
    return data.board.findIndex((c: { value: number | null }) => c.value == null) as number;
  });
}

test("notes: toggle note mode, add a candidate, and it survives refresh", async ({ page }) => {
  await startGame(page);
  const idx = await firstEmpty(page);

  await page.getByTestId("tool-note").click(); // enter note mode
  await expect(page.getByTestId("note-banner")).toBeVisible();

  await page.getByTestId(`cell-${idx}`).click();
  await page.getByTestId("pad-3").click();
  await expect(page.getByTestId(`notes-${idx}`)).toContainText("3");

  await page.reload();
  await expect(page.getByTestId(`notes-${idx}`)).toContainText("3");
});

test("undo: a committed value can be undone", async ({ page }) => {
  await startGame(page);
  const idx = await firstEmpty(page);
  await page.getByTestId("mode-unchecked").click();
  await page.getByTestId(`cell-${idx}`).click();
  await page.getByTestId("pad-5").click();
  await expect(page.getByTestId(`value-${idx}`)).toHaveText("5");
  await page.getByTestId("tool-undo").click();
  await expect(page.getByTestId(`value-${idx}`)).toHaveCount(0);
});

test("gentle mode: a wrong digit shows a gentle message and is not committed", async ({ page }) => {
  await startGame(page);
  const idx = await firstEmpty(page);
  // Default mode is gentle. For a solvable cell at most one digit is correct; try each
  // digit until one is rejected — that proves the wrong-digit gentle path (§11).
  await page.getByTestId(`cell-${idx}`).click();
  for (let d = 1; d <= 9; d++) {
    await page.getByTestId(`pad-${d}`).click();
    const toast = page.getByTestId("gentle-toast");
    if (await toast.isVisible().catch(() => false)) {
      await expect(page.getByTestId(`cell-${idx}`)).not.toHaveText(String(d));
      return; // proved: wrong digit rejected with gentle message
    }
    // If it committed (a correct digit), clear it and keep hunting for a wrong one.
    const txt = await page.getByTestId(`cell-${idx}`).textContent();
    if (txt?.trim() === String(d)) await page.getByTestId("tool-delete").click();
  }
  throw new Error("expected at least one wrong digit to trigger the gentle toast");
});

test("hint: layered hint fills a cell and the fill can be undone", async ({ page }) => {
  await startGame(page);
  await page.getByTestId("tool-hint").click();
  await expect(page.getByTestId("hint-layer")).toContainText("1/3");
  await page.getByTestId("hint-more").click();
  await expect(page.getByTestId("hint-layer")).toContainText("2/3");
  await page.getByTestId("hint-reveal").click();
  await expect(page.getByTestId("hint-layer")).toContainText("3/3");
  await page.getByTestId("hint-fill").click();

  // A cell got filled; undo should remove it.
  const filledCount = await page.evaluate(() => {
    const data = JSON.parse(window.localStorage.getItem("nekoSudoku.activeGame")!).data;
    return data.board.filter((c: { value: number | null; given: boolean }) => c.value != null && !c.given).length;
  });
  expect(filledCount).toBeGreaterThanOrEqual(1);
  await page.getByTestId("tool-undo").click();
  const afterUndo = await page.evaluate(() => {
    const data = JSON.parse(window.localStorage.getItem("nekoSudoku.activeGame")!).data;
    return data.board.filter((c: { value: number | null; given: boolean }) => c.value != null && !c.given).length;
  });
  expect(afterUndo).toBe(filledCount - 1);
});

test("no live timer is shown while playing; completion shows total elapsed", async ({ page }) => {
  await startGame(page);
  // §14: the play screen must NOT display a running clock.
  await expect(page.getByText(/用了.*[分秒]/)).toHaveCount(0);

  // Solve fully by repeatedly applying the logical hint (guaranteed correct placements).
  for (let step = 0; step < 200; step++) {
    const done = await page.getByTestId("done").isVisible().catch(() => false);
    if (done) break;
    await page.getByTestId("tool-hint").click();
    await page.getByTestId("hint-reveal").click();
    const hasFill = await page.getByTestId("hint-fill").isVisible().catch(() => false);
    if (!hasFill) {
      await page.getByTestId("hint-dismiss").click();
      break;
    }
    await page.getByTestId("hint-fill").click();
  }
  await expect(page.getByTestId("done")).toBeVisible();
  await expect(page.getByTestId("done-time")).toContainText("这一局用了");
});

test("lifecycle: visibility hidden→visible does not crash and game persists", async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page).toHaveURL(/\/play$/);
  const persisted = await page.evaluate(() => !!window.localStorage.getItem("nekoSudoku.activeGame"));
  expect(persisted).toBe(true);
});

// ---- FIX-1: completed game must not be offered as "继续上一局" ----
test("FIX-1: completion clears activeGame; home offers no continue button", async ({ page }) => {
  await startGame(page);
  // Solve fully via logical hints (guaranteed correct placements).
  for (let step = 0; step < 200; step++) {
    if (await page.getByTestId("done").isVisible().catch(() => false)) break;
    await page.getByTestId("tool-hint").click();
    await page.getByTestId("hint-reveal").click();
    if (!(await page.getByTestId("hint-fill").isVisible().catch(() => false))) {
      await page.getByTestId("hint-dismiss").click();
      break;
    }
    await page.getByTestId("hint-fill").click();
  }
  await expect(page.getByTestId("done")).toBeVisible();
  await expect(page.getByTestId("done-time")).toContainText("这一局用了");

  // Persistent activeGame must be gone.
  const absent = await page.evaluate(() => window.localStorage.getItem("nekoSudoku.activeGame") == null);
  expect(absent).toBe(true);

  // Back to home → no "继续上一局".
  await page.getByRole("button", { name: "回到首页" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "继续上一局" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "开始一局" })).toBeVisible();
});

// ---- FIX-3: conflict carries a non-color signal and 320 layout stays clean ----
test("FIX-3: unchecked conflict shows a non-color marker without overflow", async ({ page }) => {
  await startGame(page);
  await page.getByTestId("mode-unchecked").click();

  // Create a guaranteed row conflict: duplicate a given digit into an empty cell in the
  // same row. Find a given cell and an empty cell sharing its row from storage.
  const plan = await page.evaluate(() => {
    const data = JSON.parse(window.localStorage.getItem("nekoSudoku.activeGame")!).data;
    const board = data.board as { given: boolean; value: number | null }[];
    for (let r = 0; r < 9; r++) {
      let givenVal: number | null = null;
      let givenIdx = -1;
      let emptyIdx = -1;
      for (let c = 0; c < 9; c++) {
        const i = r * 9 + c;
        if (board[i].given && board[i].value != null) {
          givenVal = board[i].value;
          givenIdx = i;
        } else if (board[i].value == null) {
          emptyIdx = i;
        }
      }
      if (givenVal != null && emptyIdx >= 0 && givenIdx >= 0) {
        return { emptyIdx, digit: givenVal };
      }
    }
    return null;
  });
  expect(plan).not.toBeNull();

  await page.getByTestId(`cell-${plan!.emptyIdx}`).click();
  await page.getByTestId(`pad-${plan!.digit}`).click();

  // Non-color signal: the "!" marker is present…
  await expect(page.getByTestId(`conflict-${plan!.emptyIdx}`)).toHaveText("!");
  // …and the aria-label announces 冲突 for screen readers.
  await expect(page.getByTestId(`cell-${plan!.emptyIdx}`)).toHaveAttribute("aria-label", /冲突/);
  // …and the digit itself is still readable (its own element, not merged with the marker).
  await expect(page.getByTestId(`value-${plan!.emptyIdx}`)).toHaveText(String(plan!.digit));

  // No horizontal overflow on this viewport (covers 320×568 and 390×844 via projects).
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
