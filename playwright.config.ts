import { defineConfig, devices } from "@playwright/test";

// Minimal M1 E2E (§32, §33). Runs against a production Vite preview server.
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
    { name: "iphone-se", use: { ...devices["Desktop Chrome"], viewport: { width: 320, height: 568 } } },
    { name: "iphone-12", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
  ],
});
