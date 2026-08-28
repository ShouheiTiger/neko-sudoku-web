# Deployment Requirements — Neko Sudoku V1 (Release Candidate)

> ⚠️ This document describes deployment REQUIREMENTS only. V1 Release Prep does **not** deploy
> anything (§73). No server upload, DNS, domain, CDN publish, or public production access is
> performed until explicitly authorized with a target.

The app is a **pure static client-side SPA** (Vite build → `dist/`). No server runtime, no
database, no API. All data is same-origin static assets + browser `localStorage`.

## Hosting

- Serve the contents of `dist/` as static files over **HTTPS** (required).
- **SPA fallback**: unknown paths must serve `dist/index.html` so client-side routes deep-link /
  refresh correctly. The following routes are client-rendered and MUST fall back to index.html on
  a direct refresh (§43):
  - `/`  `/new`  `/play`  `/settings`  `/history`  `/help`  `/tutorial`
- **Same-origin assets**: JS/CSS and the puzzle-bank chunks (`assets/l{1..4}-*.js`) and any cat
  assets must be served from the same origin as the HTML (§22/§36). Zero third-party runtime
  requests are expected.

Example rewrite (nginx):

```nginx
location / { try_files $uri /index.html; }
```

## Cache strategy (§44)

| Asset | Cache |
|---|---|
| `index.html` | short / `no-cache` (always revalidate) |
| Hashed JS/CSS (`assets/*-<hash>.js|css`) | `immutable`, long max-age |
| Puzzle bank chunks (`assets/l{1..4}-<hash>.js`) | long cache (content-hashed) |

Because filenames are content-hashed by Vite, a future bank update ships new hashes and clients
never receive stale content. The logical bank identity is also carried by `bankVersion` (`v1`)
inside each file, so a versioned path / bankVersion bump distinguishes bank generations (§44).

## Puzzle bank delivery (§21)

- The 1200 puzzles are **NOT** in the initial JS bundle. Each level is a separate lazy chunk
  imported on demand by `src/data/bank/loader.ts`.
- Initial JS gzip: **~95 KB** (< 200 KB target). Per-level chunk gzip: L1 ≈16.7 KB, L2 ≈24.2 KB,
  L3 ≈32.5 KB, L4 ≈24.6 KB.

## Load-failure behaviour (§45)

If a puzzle chunk fails to load (404 / invalid JSON / schema mismatch / wrong bankVersion /
empty), the app shows a gentle message ("题目暂时没有准备好，请再试一次。") with **重试 / 返回**
— never a white screen, never a corrupt active game.

## Not in V1

No Service Worker / PWA / offline install, no analytics or trackers, no push, no accounts, no
cloud sync (§3/§35). Do not add these during deployment.
