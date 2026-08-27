import "@testing-library/react";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Ensure DOM + localStorage are reset between tests.
afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    /* localStorage may be unavailable in some environments */
  }
});
