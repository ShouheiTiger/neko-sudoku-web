import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Cat } from "../src/components/Cat/Cat.js";
import { catAsset, type CatState } from "../src/lib/cat.js";

const STATES: CatState[] = ["idle", "thinking", "sleeping", "hinting", "celebrating"];

describe("Cat component — final WebP asset render", () => {
  it("renders the correct per-state image with a decorative (empty) alt", () => {
    for (const s of STATES) {
      const { container } = render(<Cat state={s} difficulty={1} />);
      const img = container.querySelector<HTMLImageElement>("[data-testid='cat-art-img']");
      expect(img, `img for ${s}`).not.toBeNull();
      // jsdom resolves src to an absolute URL; assert it ends with the mapped local path.
      expect(img!.getAttribute("src")).toBe(catAsset(s));
      expect(img!.getAttribute("alt")).toBe(""); // decorative
      expect(img!.getAttribute("aria-hidden")).toBe("true");
      // container reflects the state (used by CSS animation class) without shifting layout.
      const box = container.querySelector("[data-testid='cat-art']")!;
      expect(box.className).toContain(`cat-anim-${s}`);
      expect(container.querySelector("[data-testid='cat']")!.getAttribute("data-cat-state")).toBe(s);
      cleanup();
    }
  });

  it("companion copy remains the screen-reader information channel (not the image)", () => {
    render(<Cat state="idle" difficulty={2} />);
    const copy = screen.getByTestId("cat-copy");
    expect(copy.textContent && copy.textContent.length).toBeTruthy();
    // The image must NOT carry the semantic text.
    const img = screen.getByTestId("cat-art-img");
    expect(img.getAttribute("alt")).toBe("");
    cleanup();
  });

  it("large size uses the large art box (no emoji font sizing leakage)", () => {
    const { container } = render(<Cat state="celebrating" difficulty={4} size="large" />);
    expect(container.querySelector(".cat-companion.cat-large")).not.toBeNull();
    expect(container.querySelector("[data-testid='cat-art-img']")).not.toBeNull();
    cleanup();
  });
});
