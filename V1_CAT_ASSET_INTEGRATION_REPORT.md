# V1 Cat Asset Integration Report — Neko Sudoku

- **Base SHA (Release Candidate)**: `033006919ef289206b4e73e71b4ef30cf0239b95`
- **Branch**: `feature/v1-cat-assets` (created from the RC; main untouched)
- **Final SHA**: see push record at the end.
- **Scope**: replace the emoji placeholder with the final 5 cat WebP assets. Asset integration
  only — no gameplay / logic / schema / bank changes.

## 1. Assets (local, same-origin)

Directory: `public/cats/` → served at `/cats/*.webp` (Vite publicDir; copied verbatim to
`dist/cats/`, never inlined into JS).

| File | Path | Size (bytes) | Dimensions | Format |
|---|---|---|---|---|
| cat-idle.webp | `/cats/cat-idle.webp` | 44,726 | 512×512 | WebP, alpha |
| cat-thinking.webp | `/cats/cat-thinking.webp` | 43,522 | 512×512 | WebP, alpha |
| cat-sleeping.webp | `/cats/cat-sleeping.webp` | 45,892 | 512×512 | WebP, alpha |
| cat-hinting.webp | `/cats/cat-hinting.webp` | 47,402 | 512×512 | WebP, alpha |
| cat-celebrating.webp | `/cats/cat-celebrating.webp` | 52,172 | 512×512 | WebP, alpha |
| **Total** | — | **233,714 (≈228 KB)** | — | — |

All 5 verified: WebP, 512×512, transparent (alpha=Blend), no external URL, no 404, build packs
them into `dist/cats/`, stable lowercase filenames.

## 2. CatState → asset mapping

`catAsset(state)` in `src/lib/cat.ts` — a pure lookup, no state-machine influence:

```
idle        → /cats/cat-idle.webp
thinking    → /cats/cat-thinking.webp
sleeping    → /cats/cat-sleeping.webp
hinting     → /cats/cat-hinting.webp
celebrating → /cats/cat-celebrating.webp
```

`Cat.tsx` renders `<img class="cat-art-img" alt="" aria-hidden="true" decoding="async">`. The
emoji placeholder was removed from the primary render; `catEmoji()` is retained ONLY as an
`onError` fallback (graceful degradation §45) and its existing unit assertion is preserved.

## 3. Accessibility

- Cat image is decorative: `alt=""` + `aria-hidden="true"`. Screen readers do not announce
  "cat idle image". The companion **copy** (`.cat-copy`) remains the information channel.

## 4. CSS animation (unchanged philosophy, image-based box)

`.cat-art` is now a fixed box (56×56, large 92×92) with `object-fit: contain`, so switching among
the 5 images never shifts layout. Light CSS-only animations:

- idle: breathe (translateY ±2px, 4s loop)
- thinking: tilt (rotate ±2.5°, 1.6s loop)
- hinting: gentle breathe (2.2s loop)
- sleeping: essentially still (opacity 0.9)
- celebrating: pop (scale 0.96→1.05→1, 0.6s once)

No frame-by-frame animation, no GIF/Lottie/video/animation library.

## 5. Reduced Motion

`@media (prefers-reduced-motion: reduce)` forces `animation/transition/transform: none` on the cat
box. **Result (Playwright, chromium 320/390)**: static image still shows; `getComputedStyle(box)
.animationName === "none"`; state switching still works. **PASS.**

## 6. Layout / mobile (320×568, 390×844)

- Fixed art box + reserved `min-height` (84/120) → Board / Toolbar / NumberPad / Hint UI do not
  move across the 5 states; no layout shift.
- No horizontal overflow at either viewport (Playwright asserts `scrollWidth - clientWidth ≤ 1`).
- Large Text ON/OFF: only copy scales, art box fixed → cat unaffected. **PASS.**

## 7. Runtime state → asset (Playwright, real browser)

- playing → `/cats/cat-idle.webp`, same-origin (`http://localhost:4173/…`), `naturalWidth > 0`,
  no `/cats/` 4xx responses.
- hint requested → `/cats/cat-hinting.webp`.
- completion → `/cats/cat-celebrating.webp`.
(Unit tests additionally cover sleeping mapping + all 5 component renders.)

## 8. Network

Production preview: cat images are same-origin under `/cats/`. dist scan for external image hosts
(`https?://…\.(webp|png|jpg|gif|svg)`): **NONE**. Built JS references the 5 paths as plain strings
(not base64). **PASS.**

## 9. Regression (full)

| Command | Result |
|---|---|
| `npm run validate:puzzles` | 1200 PASS, Failures=0 |
| `npx tsc --noEmit` | 0 errors |
| `npm test` (Vitest) | **215 passed** (211 baseline + 4 new cat tests) |
| `npm run build` | OK, initial JS `index-*.js` gzip **95.43 KB** (< 200 KB) |
| `npx playwright test` | **55 passed** (45 baseline + 10 new cat-asset tests) |
| `npm run release:check` | PASS (validate → tsc → test → build) |

Cat assets total ≈228 KB, served as static files (dist/cats), NOT inlined into JS.

## 10. Frozen surfaces — unchanged

Cat state transitions, cat copy, no-hidden-grading, `useCatCompanion` logic, elapsed/hint/
mistake/undo isolation, Sudoku Core, Hint, Solver, Difficulty, Timer, History, Settings, Large
Text, Tutorial, Production Puzzle Bank, ActiveGame schema — **all untouched**. Changes limited to:
`src/lib/cat.ts` (+catAsset, catEmoji→fallback doc), `src/components/Cat/Cat.tsx` (img render),
`src/app/styles.css` (art box + anim), `public/cats/*.webp`, and tests.

---

CAT_ASSET_STATUS = FINAL
V1_CAT_ASSET_INTEGRATION_SELF_CHECK = PASS

> Stopped. Not merged to main, not deployed. Awaiting Cat Asset Integration Review.
