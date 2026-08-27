import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DifficultyPage } from "../src/pages/DifficultyPage/DifficultyPage.js";

// §9 UI scope guardrail: only L1..L4 difficulties render; L5/L6 never appear.
describe("DifficultyPage (§9)", () => {
  it("shows exactly the four V1 difficulties and no L5/L6", () => {
    render(
      <MemoryRouter>
        <DifficultyPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("difficulty-1")).toBeDefined();
    expect(screen.getByTestId("difficulty-2")).toBeDefined();
    expect(screen.getByTestId("difficulty-3")).toBeDefined();
    expect(screen.getByTestId("difficulty-4")).toBeDefined();
    expect(screen.queryByTestId("difficulty-5")).toBeNull();
    expect(screen.queryByTestId("difficulty-6")).toBeNull();

    // Names present, forbidden labels absent (§9).
    expect(screen.getByText(/初次见面/)).toBeDefined();
    expect(screen.queryByText(/数独高手/)).toBeNull();
    expect(screen.queryByText(/很有挑战/)).toBeNull();
  });
});
