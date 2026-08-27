import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Shared Vite + Vitest config.
// - jsdom environment so React component/store tests run; pure M0 logic tests are
//   environment-agnostic and continue to pass unchanged.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // Playwright specs live under e2e/ and must NOT be picked up by Vitest.
    exclude: ["node_modules/**", "dist/**", "e2e/**"],
  },
});
