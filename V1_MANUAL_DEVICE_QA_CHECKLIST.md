# V1 Manual Device QA Checklist — Neko Sudoku

Agent automation (Playwright) covered Chromium (320/390/1440), WebKit 390, and Firefox 390.
**Automation is not a real device.** The following MUST be executed by a human on real hardware
before public release. Do not fake PASS.

```
REAL_IOS_SAFARI_TEST      = NOT_PERFORMED_BY_AGENT   (PENDING MANUAL QA)
REAL_ANDROID_DEVICE_TEST  = NOT_PERFORMED_BY_AGENT   (PENDING MANUAL QA)
ANDROID_CHROME_EMULATION  = PASS (Chromium mobile emulation only — not a real device)
```

Mark each item PASS / FAIL / PENDING. Leave PENDING if not run — never fabricate.

## iPhone — Safari (real device)

- [ ] PENDING — Home loads ("今天也慢慢来吧。"), no layout overflow
- [ ] PENDING — New Game → pick L1 → production puzzle loads (`v1-l1-…`)
- [ ] PENDING — Board touch selects the intended cell (no mis-tap)
- [ ] PENDING — Number pad input works; targets ≥ 44px
- [ ] PENDING — Notes mode: 1–9 grid notes (never dots), add/remove
- [ ] PENDING — Undo returns to previous state
- [ ] PENDING — Hint L1→L2→L3, then direct fill; cat companion appears
- [ ] PENDING — Large Text ON: readable, no clipped buttons, notes still 1–9
- [ ] PENDING — Tutorial completes; no active game / history created
- [ ] PENDING — History shows date / difficulty / elapsed only (no score/rank)
- [ ] PENDING — Completion: 🐱 celebrating + elapsed "X分Y秒"
- [ ] PENDING — background→foreground: hidden time not counted in timer
- [ ] PENDING — Refresh mid-game restores same puzzle/board/notes/timer
- [ ] PENDING — dynamic viewport (address bar show/hide) no overflow; conflict "!" marker visible

## Android — Chrome (real device)

- [ ] PENDING — same 14 checks as above
- [ ] PENDING — system font rendering acceptable
- [ ] PENDING — focus-visible outline on keyboard nav (if external keyboard)

## Accessibility spot-check (real device + screen reader)

- [ ] PENDING — VoiceOver/TalkBack announces cell coordinates, givens, conflicts
- [ ] PENDING — muted text (cat copy / settings hint / history / completion subcopy) legible
- [ ] PENDING — Reduced Motion respected (no cat animation)

## Product sign-off

- [ ] PENDING — `CAT_ASSET_STATUS = PLACEHOLDER` (emoji). Confirm whether final art is required
      before public release. Placeholder does not block the technical gate but is a product item.
