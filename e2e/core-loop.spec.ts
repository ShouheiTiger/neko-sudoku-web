import { test, expect } from "@playwright/test";

// §32 full smoke: open / -> start -> pick difficulty -> /play -> tap empty cell ->
// enter digit -> refresh -> digit persists. Plus: /play with no activeGame redirects home.
// §33: no horizontal scroll at 320 and 390 viewports.

// NOTE: we clear storage by navigating first, then clearing — we must NOT use
// addInitScript(clear), because that re-runs on page.reload() and would wipe the very
// game we are trying to prove survives a refresh.
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("core loop: start, input, refresh keeps the number", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("今天也慢慢来吧。")).toBeVisible();

  await page.getByRole("button", { name: "开始一局" }).click();
  await expect(page.getByText("选择难度")).toBeVisible();

  await page.getByTestId("difficulty-1").click();
  await expect(page).toHaveURL(/\/play$/);

  // Find the first empty (non-given) cell and select it.
  const emptyIndex = await page.evaluate(() => {
    const raw = window.localStorage.getItem("nekoSudoku.activeGame");
    if (!raw) return -1;
    const data = JSON.parse(raw).data;
    return data.board.findIndex((c: { value: number | null }) => c.value == null);
  });
  expect(emptyIndex).toBeGreaterThanOrEqual(0);

  await page.getByTestId(`cell-${emptyIndex}`).click();
  await page.getByTestId("pad-7").click();
  await expect(page.getByTestId(`cell-${emptyIndex}`)).toHaveText("7");

  // Refresh: number must persist (§7, §21).
  await page.reload();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByTestId(`cell-${emptyIndex}`)).toHaveText("7");

  // Home now offers "继续上一局".
  await page.getByRole("button", { name: "首页" }).click();
  await expect(page.getByRole("button", { name: "继续上一局" })).toBeVisible();
});

test("/play with no active game redirects to home", async ({ page }) => {
  await page.goto("/play");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("今天也慢慢来吧。")).toBeVisible();
});

test("no horizontal scroll on this viewport", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始一局" }).click();
  await page.getByTestId("difficulty-3").click();
  await expect(page).toHaveURL(/\/play$/);
  // board + pad must fit: scrollWidth must not exceed the viewport width.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
