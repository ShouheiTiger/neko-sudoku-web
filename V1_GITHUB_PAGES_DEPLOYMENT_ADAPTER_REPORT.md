# V1 GitHub Pages Deployment Adapter — Self-check Report

Hosting-adapter-only change set. No Sudoku / Cat / Storage / Hint / Solver / Difficulty / Timer /
History / Puzzle-Bank product logic was modified.

## Git
- Base RC SHA: `1ab7a3f7c5bc8cabb1979a125f5eaf2d1926c4c0`
- Branch: `feature/v1-github-pages-deploy` (created from the RC)
- Adapter SHA: `__ADAPTER_SHA__`

## Changed files (adapter scope only)
| File | Purpose |
|---|---|
| `vite.config.mjs` | `base = process.env.VITE_BASE || '/'` (prod build only) |
| `src/app/router.tsx` | `createBrowserRouter` `basename` derived from `import.meta.env.BASE_URL` |
| `src/lib/cat.ts` | `catAsset()` now base-aware (`${BASE_URL}cats/cat-<state>.webp`); state machine/copy untouched |
| `src/vite-env.d.ts` | (new) minimal `import.meta.env.BASE_URL` typing — additive, no runtime effect |
| `scripts/prepare-github-pages.mjs` | (new) copy `dist/index.html` → `dist/404.html`, byte-identical |
| `package.json` | (new scripts) `build:pages`, `test:pages`, `e2e:pages` |
| `.github/workflows/deploy-pages.yml` | (new) manual `workflow_dispatch` Pages deploy, dist-only artifact |
| `tests/github-pages-build.pages-test.ts` | (new) dist artifact verification (base, 404, cats, chunks) |
| `vitest.pages.config.ts` | (new) isolated config for the pages build test |
| `e2e-pages/pages-base.spec.ts` | (new) base-path E2E (routes, cat URLs, chunk 404) |
| `playwright.pages.config.ts` | (new) isolated config; builds+serves under base |

Baseline `vitest.config.ts` gained one exclusion so the pages tests don't run inside `npm test`.

## Adapter parameters
- **VITE_BASE** = `/neko-sudoku-web/` (set only by `build:pages`; dev / `npm run build` / baseline
  Playwright preview stay at `/`)
- **ROUTER_BASENAME** = `/neko-sudoku-web` in production (BASE_URL with trailing slash stripped);
  `undefined` at root/dev — existing route strings and `<Link>`/`navigate()` calls unchanged
- **CAT_ASSET_BASE** = `${import.meta.env.BASE_URL}cats/cat-<state>.webp`
  → prod `/neko-sudoku-web/cats/...`, dev/root `/cats/...`; no hardcoded GitHub host
- **SPA_404_FALLBACK** = `dist/404.html` is a byte-identical copy of `dist/index.html`
  (HashRouter NOT used; URLs stay clean)

## Workflow
- `.github/workflows/deploy-pages.yml`, trigger `workflow_dispatch` only (no push auto-deploy).
- Permissions: `contents: read`, `pages: write`, `id-token: write`.
- Environment `github-pages` with `url: ${{ steps.deployment.outputs.page_url }}`.
- Build gate before upload: `npm install` → `validate:puzzles` → `tsc --noEmit` → `npm test` →
  `build:pages`. Uploads `./dist` only. Separate `deploy` job needs `build`.

## Node / lockfile
- **Node version** pinned to major **20** in the workflow (same major as the RC regression
  environment); not `latest`.
- Repository note: a `package-lock.json` IS present in the tree, but the deployment adapter does
  NOT rely on it and does NOT modify/regenerate it. The workflow uses `npm install` (no
  lockfile-based npm cache), matching the instruction's intent.
  **NO_LOCKFILE = EXISTING_BACKLOG** (recorded as directed; lockfile handling left untouched.)

## Local regression (branch `feature/v1-github-pages-deploy`)
| Check | Result |
|---|---|
| `validate:puzzles` (Production Bank) | **1200 PASS**, Failures=0 |
| `tsc --noEmit` | 0 errors |
| `npm test` (Vitest baseline) | **215 passed** (unchanged) |
| `npm run test:pages` (dist artifact checks) | 4 passed |
| `npm run build:pages` | OK — assets under `/neko-sudoku-web/`, `404.html` == `index.html`, 5 cats in `dist/cats` |
| Initial JS gzip (pages build) | **95.49 KB** (< 200 KB) |
| `npm run build` (root, via release:check) | OK — assets under `/`, gzip 95.40 KB |
| `npx playwright test` (baseline root suite) | **55 passed** (unchanged) |
| `npm run e2e:pages` (base-path E2E) | 3 passed |
| `npm run release:check` | PASS |
| Cat assets | 5 / all present in dist / decoded (naturalWidth=512) / no `/cats/` root request / no 404 |

## Frozen-core confirmation
`git diff` limited to the adapter files above. `src/lib/cat.ts` change is confined to the
`catAsset()` URL builder; Cat state machine, copy, `catStateForScreen`, and `catEmoji` fallback are
byte-unchanged. No solver / hint / candidate / difficulty / game-engine / storage / history /
timer / activeGame / puzzle-bank-JSON edits.

---

V1_GITHUB_PAGES_ADAPTER_SELF_CHECK = PASS

> Stopped after push. NOT deployed. Awaiting Independent Adapter Review, then FF merge to main +
> product-owner manual workflow run.
