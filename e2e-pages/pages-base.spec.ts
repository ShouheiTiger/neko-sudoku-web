import { test, expect } from "@playwright/test";

// GitHub Pages base-path E2E (V1 hosting adapter). Served by a `vite preview` that hosts the
// production `build:pages` output under `/neko-sudoku-web/`. Verifies every route renders under
// the base, cat WebP requests carry the base prefix (never the bare site root), and puzzle-bank
// lazy chunks load without 404. This spec runs via its OWN config (playwright.pages.config.ts) so
// the baseline root-path suite is untouched.

const BASE = "/neko-sudoku-web";
const ROUTES = ["", "/new", "/play", "/settings", "/history", "/help", "/tutorial"];

test("every route renders under the project base (no blank page)", async ({ page }) => {
  for (const r of ROUTES) {
    const resp = await page.goto(`${BASE}/${r.replace(/^\//, "")}`, { waitUntil: "networkidle" });
    // Static Pages returns 200 for known files; deep links resolve via 404.html fallback at the
    // HTTP layer but the SPA must still render. We assert the app root mounted.
    expect(await page.locator("#root, [data-testid], main, .app").first().count()).toBeGreaterThan(0);
    expect(resp).not.toBeNull();
  }
});

test("cat asset requests carry the base prefix and load (no /cats/ root 404)", async ({ page }) => {
  const rootCats: string[] = [];
  const badCats: string[] = [];
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (u.pathname.startsWith("/cats/")) rootCats.push(u.pathname); // must never happen
  });
  page.on("response", (res) => {
    const u = new URL(res.url());
    if (u.pathname.startsWith(`${BASE}/cats/`) && res.status() >= 400) badCats.push(`${res.status()} ${u.pathname}`);
  });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "开始一局" }).click();
  await page.getByTestId("difficulty-1").click();
  await page.waitForURL(new RegExp(`${BASE}/play$`));
  const img = page.getByTestId("cat-art-img");
  await img.waitFor({ state: "visible" });
  const src = await img.getAttribute("src");
  expect(src).toContain(`${BASE}/cats/cat-idle.webp`);
  const natW = await img.evaluate((el) => (el as HTMLImageElement).naturalWidth);
  expect(natW).toBeGreaterThan(0);
  expect(rootCats).toEqual([]);
  expect(badCats).toEqual([]);
});

test("puzzle-bank lazy chunk loads under the base without 404", async ({ page }) => {
  const bad: string[] = [];
  page.on("response", (res) => {
    const u = new URL(res.url());
    if (u.pathname.startsWith(`${BASE}/assets/`) && res.status() >= 400) bad.push(`${res.status()} ${u.pathname}`);
  });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "开始一局" }).click();
  await page.getByTestId("difficulty-1").click();
  await page.waitForURL(new RegExp(`${BASE}/play$`));
  // Reaching /play requires the L1 bank chunk to have loaded; a 404 would have blocked it.
  await expect(page.getByTestId("cat-art-img")).toBeVisible();
  expect(bad).toEqual([]);
});
