import { test, expect, type Page } from "@playwright/test";

// V1.0.1 UX fix: 3x3 box separation (UX-01) + notes readability (UX-02).
// Computed-style / geometry assertions (no fragile pixel screenshots).

const VIEWPORTS = [
  { w: 320, h: 568 },
  { w: 360, h: 800 },
  { w: 390, h: 844 },
];

async function startGame(page: Page) {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "开始一局" }).click();
  await page.getByTestId("difficulty-1").click();
  await page.getByTestId("mode-gentle").waitFor({ state: "visible" });
}

// Find an empty (non-given) cell index from the persisted activeGame.
async function emptyCellIndex(page: Page): Promise<number> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem("nekoSudoku.activeGame");
    const data = JSON.parse(raw!).data;
    return data.board.findIndex((c: { value: number | null; given: boolean }) => c.value == null && !c.given);
  });
}

async function fillNotes(page: Page, cellIdx: number, digits: number[]) {
  await page.getByTestId("tool-note").click(); // enter note mode
  await page.getByTestId(`cell-${cellIdx}`).click();
  for (const d of digits) await page.getByTestId(`pad-${d}`).click();
}

function normalizedShadow(shadow: string) {
  return shadow.replace(/\s+/g, " ");
}

function expectInsetSeparator(shadow: string, axis: "horizontal" | "vertical") {
  const normalized = normalizedShadow(shadow);
  expect(normalized).toContain("inset");
  expect(normalized).toContain("3px");
  if (axis === "vertical") {
    expect(normalized).toMatch(/-3px 0px 0px 0px.*inset|inset -3px 0px 0px 0px/);
  } else {
    expect(normalized).toMatch(/0px -3px 0px 0px.*inset|inset 0px -3px 0px 0px/);
  }
}

// ---- TEST A: 3x3 box boundary is visually stronger than an ordinary internal cell ----
test("UX-01 box boundaries (col 3/6, row 3/6) are inset and stronger than ordinary cells", async ({ page }) => {
  await startGame(page);
  // box-right lives on col index 2 and 5 (0-based) -> cells 2, 5 in row 0.
  // box-bottom lives on row index 2 and 5 -> cells 18, 45 in col 0.
  const shadow = (idx: number) =>
    page.getByTestId(`cell-${idx}`).evaluate((el) => getComputedStyle(el).boxShadow);

  const c2 = await shadow(2); // col3/4 boundary
  const c5 = await shadow(5); // col6/7 boundary
  const r18 = await shadow(18); // row3/4 boundary (index 18 = row2,col0)
  const r45 = await shadow(45); // row6/7 boundary (index 45 = row5,col0)
  const cross = await shadow(20); // row3/4 + col3/4 intersection
  const ordinary = await shadow(0); // top-left ordinary cell (no box-right/bottom)
  const ordinary2 = await shadow(1);

  // Boundary cells carry a box-shadow; ordinary interior cells (col!=2,5 & row!=2,5) do not.
  for (const s of [c2, c5, r18, r45]) {
    expect(s === "none" || s === "").toBeFalsy();
  }
  expect(ordinary === "none" || ordinary === "").toBeTruthy();
  expect(ordinary2 === "none" || ordinary2 === "").toBeTruthy();

  // Regression for the horizontal-boundary bug: separators must be drawn inside the
  // owning cell, not outward where the next row can cover the shadow.
  expectInsetSeparator(c2, "vertical");
  expectInsetSeparator(c5, "vertical");
  expectInsetSeparator(r18, "horizontal");
  expectInsetSeparator(r45, "horizontal");
  expect(normalizedShadow(cross).match(/inset/g)?.length).toBe(2);
  expectInsetSeparator(cross, "vertical");
  expectInsetSeparator(cross, "horizontal");

  // Outer board border must render strictly stronger than the 3px 3x3 box boundary.
  // Declared 4px; read the real Chromium computed border-width and compare as a number.
  const outer = await page.locator(".board").evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth));
  expect(outer).toBeGreaterThan(3);
});

// ---- TEST B/C: notes 1-9 all present in fixed 3x3 slots; 2/5/8 fixed positions ----
test("UX-02 notes 1-9 render in fixed slots; 2/5/8 stay top/center/bottom center", async ({ page }) => {
  await startGame(page);
  const idx = await emptyCellIndex(page);
  expect(idx).toBeGreaterThanOrEqual(0);

  // Fill all 9 notes.
  await fillNotes(page, idx, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const notes = page.getByTestId(`notes-${idx}`);
  const slots = notes.locator(".note-cell");
  await expect(slots).toHaveCount(9);
  // Each slot shows its digit (slot n renders digit n+1 when present).
  for (let i = 0; i < 9; i++) {
    await expect(slots.nth(i)).toHaveText(String(i + 1));
  }
  // No overlap: each slot's box is within the notes container and boxes don't intersect.
  const boxes = await slots.evaluateAll((els) =>
    els.map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }),
  );
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!, b = boxes[j]!;
      const overlap = a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
      expect(overlap, `slots ${i}/${j} overlap`).toBeFalsy();
    }
  }

  // Now a cell with only 2/5/8 -> slots 1(top-center),4(center),7(bottom-center) filled, rest empty.
  await startGame(page);
  const idx2 = await emptyCellIndex(page);
  await fillNotes(page, idx2, [2, 5, 8]);
  const slots2 = page.getByTestId(`notes-${idx2}`).locator(".note-cell");
  await expect(slots2.nth(1)).toHaveText("2"); // top-center
  await expect(slots2.nth(4)).toHaveText("5"); // center
  await expect(slots2.nth(7)).toHaveText("8"); // bottom-center
  for (const empty of [0, 2, 3, 5, 6, 8]) {
    await expect(slots2.nth(empty)).toHaveText("");
  }
});

// ---- TEST D + responsive matrix: notes readable & no overflow at 320/360/390 x Normal/Large ----
for (const vp of VIEWPORTS) {
  for (const large of [false, true]) {
    test(`UX-02 notes fit + readable ${vp.w}x${vp.h} large=${large}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await startGame(page);
      if (large) await page.evaluate(() => document.documentElement.setAttribute("data-large-text", ""));
      const idx = await emptyCellIndex(page);
      await fillNotes(page, idx, [1, 2, 3, 4, 5, 6, 7, 8, 9]);

      const notes = page.getByTestId(`notes-${idx}`);
      const cell = page.getByTestId(`cell-${idx}`);
      const nBox = await notes.boundingBox();
      const cBox = await cell.boundingBox();
      // notes container stays within the cell (no overflow/clipping past cell bounds).
      expect(nBox!.x).toBeGreaterThanOrEqual(cBox!.x - 1);
      expect(nBox!.y).toBeGreaterThanOrEqual(cBox!.y - 1);
      expect(nBox!.x + nBox!.width).toBeLessThanOrEqual(cBox!.x + cBox!.width + 1);
      expect(nBox!.y + nBox!.height).toBeLessThanOrEqual(cBox!.y + cBox!.height + 1);

      // No page horizontal overflow; board square-ish.
      const hOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(hOverflow).toBeLessThanOrEqual(1);

      // Effective note font-size is a positive, readable value; Large Text >= Normal.
      const fs = await notes.locator(".note-cell").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(fs).toBeGreaterThanOrEqual(9);
    });
  }
}

// ---- TEST D explicit: Large Text notes strictly larger than Normal at the same viewport ----
test("UX-02 Large Text increases note font-size vs Normal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startGame(page);
  const idx = await emptyCellIndex(page);
  await fillNotes(page, idx, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const noteCell = page.getByTestId(`notes-${idx}`).locator(".note-cell").first();

  const normal = await noteCell.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  await page.evaluate(() => document.documentElement.setAttribute("data-large-text", ""));
  const largeFs = await noteCell.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(largeFs).toBeGreaterThan(normal);
});
