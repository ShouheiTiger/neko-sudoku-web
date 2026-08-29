// GitHub Pages SPA fallback preparer (V1 hosting adapter).
//
// GitHub Pages serves static files only — it has no server-side SPA rewrite (no nginx
// `try_files`). When a visitor opens a deep link such as `/neko-sudoku-web/settings` directly (or
// refreshes it), Pages looks for a matching file, doesn't find one, and serves `404.html`. By
// making `404.html` a byte-for-byte copy of `index.html`, the same React/BrowserRouter bundle
// boots and the client router restores the intended route.
//
// This script ONLY copies dist/index.html -> dist/404.html. It never edits HTML content and never
// touches product logic. Run after `vite build` (see `npm run build:pages`).

import { existsSync, copyFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const dist = resolve(process.cwd(), "dist");
const indexHtml = resolve(dist, "index.html");
const notFoundHtml = resolve(dist, "404.html");

if (!existsSync(indexHtml)) {
  console.error(`[prepare-github-pages] ERROR: ${indexHtml} not found. Run \`vite build\` first.`);
  process.exit(1);
}

copyFileSync(indexHtml, notFoundHtml);

const a = statSync(indexHtml).size;
const b = statSync(notFoundHtml).size;
if (a !== b) {
  console.error(`[prepare-github-pages] ERROR: 404.html size ${b} != index.html size ${a}.`);
  process.exit(1);
}

console.log(`[prepare-github-pages] OK: copied dist/index.html -> dist/404.html (${a} bytes).`);
