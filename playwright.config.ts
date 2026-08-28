import { defineConfig, devices } from "@playwright/test";

// V1 Release Prep §48-§51 cross-browser matrix. Runs against a production Vite preview server so
// the production puzzle-bank chunks are served exactly as they ship.
//
// - Chromium mobile (iphone-se 320, iphone-12 390): the FULL suite incl. completion/storage (§49).
// - Chromium desktop 1440 + WebKit 390 + Firefox 390: the lightweight cross-browser SMOKE only
//   (core-loop.spec.ts), per §49 "each browser at least smoke; Chromium full".
const FULL = ["**/*.spec.ts"];
const SMOKE = ["**/core-loop.spec.ts"];

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173",
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173",
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    // Chromium mobile viewports — primary, full flow.
    { name: "iphone-se", testMatch: FULL, use: { ...devices["Desktop Chrome"], viewport: { width: 320, height: 568 } } },
    { name: "iphone-12", testMatch: FULL, use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
    // Chromium desktop (§48) — smoke.
    { name: "chromium-1440", testMatch: SMOKE, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    // WebKit (Safari engine, §50) — smoke.
    { name: "webkit-390", testMatch: SMOKE, use: { ...devices["Desktop Safari"], viewport: { width: 390, height: 844 } } },
    // Firefox (§48) — smoke.
    { name: "firefox-390", testMatch: SMOKE, use: { ...devices["Desktop Firefox"], viewport: { width: 390, height: 844 } } },
  ],
});
