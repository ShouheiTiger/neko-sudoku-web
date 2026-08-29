# V1 GitHub Pages Deployment Adapter — Self-check Report

Hosting-adapter-only change set. No Sudoku / Cat / Storage / Hint / Solver / Difficulty / Timer /
History / Puzzle-Bank product logic was modified.

## Git
- Base RC SHA: `1ab7a3f7c5bc8cabb1979a125f5eaf2d1926c4c0`
- Branch: `feature/v1-github-pages-deploy` (created from the RC)
- Adapter SHA: `85deb020c2f5ee74daabb9a1f1fc05d3ecf6e79e`

## Changed files (adapter scope only)
| File | Purpose |
|---|---|
| `vite.config.mjs` | `base = process.env.VITE_BASE || '/'` (prod build only) |
| `src/app/router.tsx` | `createBrowserRouter` `basename` derived from `import.meta.env.BASE_URL` |
| `src/lib/cat.ts` | `catAsset()` now base-aware (`${BASE_URL}cats/cat-<state>.webp`); state machine/copy untouched |
| `src/vite-env.d.ts` | (new) minimal `import.meta.env.BASE_URL` typing — additive, no runtime effect |
| `scripts/prepare-github-pages.mjs` | (new) copy `dist/index.html` → `dist/404.html`, byte-identical |
| `package.json` | (new scripts) `build:pages`, `test:pages`, `e2e:pages`; (fix) `build:pages` uses `cross-env`; (fix) added `cross-env` devDependency |
| `package-lock.json` | (fix) updated for the single new devDependency `cross-env` |
| `.github/workflows/deploy-pages.yml` | (new) manual `workflow_dispatch` Pages deploy, dist-only artifact; (fix) install via `npm ci` + npm cache |
| `tests/github-pages-build.pages-test.ts` | (new) dist artifact verification (base, 404, cats, chunks); (fix) nested build forced to `NODE_ENV=production` |
| `vitest.pages.config.ts` | (new) isolated config for the pages build test |
| `e2e-pages/pages-base.spec.ts` | (new) base-path E2E (routes, cat URLs, chunk 404) |
| `playwright.pages.config.ts` | (new) isolated config; builds+serves under base; (fix) preview via `cross-env` |

Baseline `vitest.config.ts` gained one exclusion so the pages tests don't run inside `npm test`.

## Fix round (adapter review PASS_WITH_FIXES → 3 fixes)
1. **Cross-platform VITE_BASE** — added `cross-env` devDependency; `build:pages` and the pages
   Playwright preview command now use `cross-env VITE_BASE=/neko-sudoku-web/` so the env var is
   injected identically on POSIX and native Windows shells. `package-lock.json` updated (only
   `cross-env` added; no other dependency changed/upgraded).
2. **Production-mode pages build test** — `tests/github-pages-build.pages-test.ts` now runs the
   nested build as `cross-env NODE_ENV=production npm run build:pages` and overrides the inherited
   env, so `test:pages` verifies a real production React bundle instead of the dev bundle Vitest's
   `NODE_ENV=test` would otherwise produce.
3. **Workflow install** — `.github/workflows/deploy-pages.yml` installs with `npm ci` (lockfile is
   tracked, `lockfileVersion 3`, valid) and enables npm caching.

**Windows verification note (honest):** this build/CI sandbox is Linux (E2B); a native Windows
shell was NOT available here, so `build:pages` / `test:pages` / `e2e:pages` could not be executed
on Windows in this environment. The fix removes the shell dependency at the root cause: `cross-env`
sets `VITE_BASE`/`NODE_ENV` identically on cmd.exe/PowerShell and POSIX, which is the standard
cross-platform mechanism. All commands were verified green on Linux via the `cross-env` code path.

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
- Build gate before upload: `npm ci` → `validate:puzzles` → `tsc --noEmit` → `npm test` →
  `build:pages`. Uploads `./dist` only. Separate `deploy` job needs `build`.

## Node / lockfile
- **Node version** pinned to major **20** in the workflow (same major as the RC regression
  environment); not `latest`.
- **LOCKFILE_STATUS = TRACKED_VALID** — `package-lock.json` is tracked, `lockfileVersion = 3`, and
  consistent with `package.json`; `npm ci` runs successfully against it.
- **WORKFLOW_INSTALL = npm ci** — the workflow installs with `npm ci` (clean, reproducible,
  lockfile-exact) and enables npm caching keyed on the lockfile.
- This fix round adds exactly one devDependency, `cross-env`, and updates `package-lock.json`
  accordingly; no other dependency was added, removed, or upgraded.

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
