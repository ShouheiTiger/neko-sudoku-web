import { createBrowserRouter } from "react-router-dom";
import { HomePage } from "../pages/HomePage/HomePage.js";
import { DifficultyPage } from "../pages/DifficultyPage/DifficultyPage.js";
import { GamePage } from "../pages/GamePage/GamePage.js";

// §6 Routes. Browser Back/Forward/Refresh all behave via the real History API.
export const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/new", element: <DifficultyPage /> },
  { path: "/play", element: <GamePage /> },
  // Unknown paths fall back to home rather than white-screening.
  { path: "*", element: <HomePage /> },
]);
