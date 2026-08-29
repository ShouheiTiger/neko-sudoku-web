import { defineConfig } from "vitest/config";

// Dedicated Vitest config for the GitHub Pages hosting-adapter build verification. It runs the
// `*.pages-test.ts` artifact checks (which invoke `npm run build:pages`) OUTSIDE the default
// `npm test` run, so the baseline unit-test suite (215) and its timing stay unchanged.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.pages-test.ts"],
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
});
