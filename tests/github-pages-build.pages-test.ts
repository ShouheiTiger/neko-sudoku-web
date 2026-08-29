import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// GitHub Pages hosting-adapter build verification (V1). Runs `npm run build:pages` and asserts the
// emitted dist is correctly rooted at the project-site base `/neko-sudoku-web/`, that the SPA 404
// fallback exists and matches index.html, and that all 5 cat WebP assets ship. Pure artifact
// checks — no product logic is exercised or modified.

const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, "dist");
const BASE = "/neko-sudoku-web/";

describe("GitHub Pages build adapter (dist under /neko-sudoku-web/)", () => {
  beforeAll(() => {
    execSync("npm run build:pages", { cwd: ROOT, stdio: "inherit" });
  }, 180_000);

  it("emits dist/index.html and a byte-identical dist/404.html SPA fallback", () => {
    const index = resolve(DIST, "index.html");
    const notFound = resolve(DIST, "404.html");
    expect(existsSync(index)).toBe(true);
    expect(existsSync(notFound)).toBe(true);
    expect(readFileSync(notFound)).toEqual(readFileSync(index));
  });

  it("index.html references assets under the project base, never the site root", () => {
    const html = readFileSync(resolve(DIST, "index.html"), "utf8");
    // At least one hashed asset must be referenced with the base prefix.
    expect(html).toMatch(new RegExp(`${BASE}assets/`));
    // No bare root-absolute asset references (would 404 on the project site).
    expect(html).not.toMatch(/(src|href)="\/assets\//);
  });

  it("ships all 5 cat WebP assets in dist/cats", () => {
    for (const s of ["idle", "thinking", "sleeping", "hinting", "celebrating"]) {
      expect(existsSync(resolve(DIST, "cats", `cat-${s}.webp`))).toBe(true);
    }
  });

  it("lazy puzzle-bank chunks are emitted under the base", () => {
    const html = readFileSync(resolve(DIST, "index.html"), "utf8");
    // The entry script must be base-prefixed; chunk URLs are derived from the same base at runtime.
    expect(html).toMatch(new RegExp(`${BASE}assets/index-.*\\.js`));
  });
});
