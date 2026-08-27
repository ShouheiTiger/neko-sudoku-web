import { createBrowserRouter } from "react-router-dom";
import { HomePage } from "../pages/HomePage/HomePage.js";
import { DifficultyPage } from "../pages/DifficultyPage/DifficultyPage.js";
import { GamePage } from "../pages/GamePage/GamePage.js";
import { SettingsPage } from "../pages/SettingsPage/SettingsPage.js";
import { HistoryPage } from "../pages/HistoryPage/HistoryPage.js";
import { HelpPage } from "../pages/HelpPage/HelpPage.js";
import { TutorialPage } from "../pages/TutorialPage/TutorialPage.js";

// §6/§28 Routes. Browser Back/Forward/Refresh all behave via the real History API.
export const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/new", element: <DifficultyPage /> },
  { path: "/play", element: <GamePage /> },
  { path: "/settings", element: <SettingsPage /> },
  { path: "/history", element: <HistoryPage /> },
  { path: "/help", element: <HelpPage /> },
  { path: "/tutorial", element: <TutorialPage /> },
  // Unknown paths fall back to home rather than white-screening.
  { path: "*", element: <HomePage /> },
]);
