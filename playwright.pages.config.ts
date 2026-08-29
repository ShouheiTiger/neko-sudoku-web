import { defineConfig, devices } from "@playwright/test";

// Standalone Playwright config for the GitHub Pages base-path E2E. It builds with the project base
// (`build:pages`) and serves the dist via `vite preview`, which honours the baked-in
// `/neko-sudoku-web/` base. Kept separate from playwright.config.ts so the baseline root-path
// suite (55) is unchanged.
export default defineConfig({
  testDir: "./e2e-pages",
  timeout: 30_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4174",
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: "npm run build:pages && VITE_BASE=/neko-sudoku-web/ npm run preview -- --host 127.0.0.1 --port 4174",
    url: "http://127.0.0.1:4174/neko-sudoku-web/",
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    { name: "pages-chromium-390", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
  ],
});
