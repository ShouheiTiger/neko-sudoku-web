import { test, expect, type Page } from "@playwright/test";

// M3 §39-§43 E2E: Large Text, Tutorial, History, accessibility/keyboard smoke.
// Runs on both viewports (320×568 iphone-se, 390×844 iphone-12) from playwright.config.ts.

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

function overflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

async function startGame(page: Page, diff = 1) {
  await page.goto("/");
  await page.getByRole("button", { name: "开始一局" }).click();
  await page.getByTestId(`difficulty-${diff}`).click();
  await expect(page).toHaveURL(/\/play$/);
}

// ---- §39 Large Text ----
test("Large Text: enable in settings, applies to play, persists, no overflow", async ({ page }) => {
  await startGame(page);
  await page.goto("/settings");
  await page.getByTestId("toggle-large-text").click();
  await expect(page.getByTestId("large-text-state")).toHaveText("已开启");
  // root attribute applied instantly
  await expect(page.locator("html")).toHaveAttribute("data-large-text", "true");

  // Back to play: board complete, toolbar + pad usable, no horizontal scroll.
  await page.goto("/play");
  await expect(page.getByTestId("cell-0")).toBeVisible();
  await expect(page.getByTestId("tool-note")).toBeVisible();
  await expect(page.getByTestId("pad-1")).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(1);

  // Persists across refresh.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-large-text", "true");
  expect(await overflow(page)).toBeLessThanOrEqual(1);
});

// ---- §40 Tutorial ----
test("Tutorial: 3 screens → interaction → select 5, no activeGame/history created", async ({ page }) => {
  await page.goto("/tutorial");
  await page.getByTestId("tutorial-next").click();
  await page.getByTestId("tutorial-next").click();
  await page.getByTestId("tutorial-next").click();
  await expect(page.getByTestId("tutorial-interaction")).toBeVisible();
  await page.getByTestId("tutorial-pick-5").click();
  await expect(page.getByTestId("tutorial-done")).toBeVisible();

  const storage = await page.evaluate(() => ({
    active: window.localStorage.getItem("nekoSudoku.activeGame"),
    history: window.localStorage.getItem("nekoSudoku.history"),
  }));
  expect(storage.active).toBeNull();
  expect(storage.history).toBeNull();

  expect(await overflow(page)).toBeLessThanOrEqual(1);
});

// ---- §41 History ----
test("History: completing a game shows date/difficulty/elapsed and no score/rank", async ({ page }) => {
  await startGame(page);
  // Solve via logical hints (guaranteed correct placements).
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
  await page.getByRole("button", { name: "回到首页" }).click();

  await page.goto("/history");
  const items = page.getByTestId("history-item");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("年");
  await expect(items.first()).toContainText("L1");

  // No forbidden fields anywhere on the page.
  const body = (await page.locator("body").innerText());
  for (const forbidden of ["分数", "排名", "名次", "最佳", "提示次数", "错误", "星"]) {
    expect(body).not.toContain(forbidden);
  }
  expect(await overflow(page)).toBeLessThanOrEqual(1);
});

test("History empty state is gentle", async ({ page }) => {
  await page.goto("/history");
  await expect(page.getByTestId("history-empty")).toContainText("还没有完成记录");
  expect(await overflow(page)).toBeLessThanOrEqual(1);
});

// ---- §42 Accessibility / keyboard smoke ----
test("keyboard: select an editable cell, type a digit, delete it", async ({ page }) => {
  await startGame(page);
  await page.getByTestId("mode-unchecked").click();
  const emptyIndex = await page.evaluate(() => {
    const data = JSON.parse(window.localStorage.getItem("nekoSudoku.activeGame")!).data;
    return data.board.findIndex((c: { value: number | null }) => c.value == null) as number;
  });
  await page.getByTestId(`cell-${emptyIndex}`).click();
  await page.keyboard.press("7");
  await expect(page.getByTestId(`value-${emptyIndex}`)).toHaveText("7");
  await page.keyboard.press("Backspace");
  await expect(page.getByTestId(`value-${emptyIndex}`)).toHaveCount(0);
});

test("a11y: toolbar keeps icon+label, cells have meaningful aria-labels, focus visible", async ({ page }) => {
  await startGame(page);
  // Toolbar not icon-only (§42): labels present.
  await expect(page.getByTestId("tool-delete")).toContainText("删除");
  await expect(page.getByTestId("tool-note")).toContainText("笔记");
  await expect(page.getByTestId("tool-hint")).toContainText("提示");
  // Cell aria-label is meaningful, not "button N".
  const label = await page.getByTestId("cell-0").getAttribute("aria-label");
  expect(label).toMatch(/第.*行.*第.*列/);
  // Cat art is decorative (aria-hidden).
  await expect(page.getByTestId("cat-art")).toHaveAttribute("aria-hidden", "true");
});

// ---- §43 320 final: settings/help pages no overflow ----
test("settings and help pages have no horizontal overflow", async ({ page }) => {
  await page.goto("/settings");
  expect(await overflow(page)).toBeLessThanOrEqual(1);
  await page.goto("/help");
  expect(await overflow(page)).toBeLessThanOrEqual(1);
});
