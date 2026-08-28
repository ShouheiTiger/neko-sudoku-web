import { test, expect } from "@playwright/test";

// V1 Cat Asset Integration E2E. Runs on the Chromium FULL projects (320/390) per
// playwright.config.ts. Verifies final WebP assets render per state, load same-origin (no 404 /
// no external host), respect reduced-motion, and never cause layout shift / horizontal scroll.

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

test("playing shows the idle cat WebP, same-origin, no 404", async ({ page }) => {
  const bad: string[] = [];
  page.on("response", (r) => {
    if (r.url().includes("/cats/") && r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
  });
  await startGame(page);
  const img = page.getByTestId("cat-art-img");
  await expect(img).toBeVisible();
  const src = await img.getAttribute("src");
  expect(src).toContain("/cats/cat-idle.webp");
  // same-origin: resolves under the preview origin, not an external CDN.
  const resolved = await img.evaluate((el) => (el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src);
  expect(resolved.startsWith("http://localhost:4173/")).toBe(true);
  // actually decoded (naturalWidth > 0 → not a broken image).
  const w = await img.evaluate((el) => (el as HTMLImageElement).naturalWidth);
  expect(w).toBeGreaterThan(0);
  expect(bad).toEqual([]);
});

test("hint switches the cat to the hinting WebP", async ({ page }) => {
  await startGame(page);
  await page.getByTestId("tool-hint").click();
  await expect(page.getByTestId("hint-layer")).toContainText("1/3");
  const src = await page.getByTestId("cat-art-img").getAttribute("src");
  expect(src).toContain("/cats/cat-hinting.webp");
});

test("completion shows the celebrating WebP", async ({ page }) => {
  await startGame(page);
  for (let step = 0; step < 200; step++) {
    if (await page.getByTestId("done").isVisible().catch(() => false)) break;
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
  const src = await page.getByTestId("cat-art-img").getAttribute("src");
  expect(src).toContain("/cats/cat-celebrating.webp");
});

test("cat image does not create horizontal overflow", async ({ page }) => {
  await startGame(page, 3);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test.describe("reduced motion", () => {
  test.use({ colorScheme: "light" });
  test("prefers-reduced-motion: cat image still shows, animation disabled", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await startGame(page);
    const box = page.getByTestId("cat-art");
    await expect(page.getByTestId("cat-art-img")).toBeVisible(); // static image still shown
    const anim = await box.evaluate((el) => getComputedStyle(el).animationName);
    // reduced-motion rule forces animation: none → computed animationName is "none".
    expect(anim).toBe("none");
  });
});
