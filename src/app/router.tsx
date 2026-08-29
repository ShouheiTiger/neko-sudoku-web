import { createBrowserRouter } from "react-router-dom";
import { HomePage } from "../pages/HomePage/HomePage.js";
import { DifficultyPage } from "../pages/DifficultyPage/DifficultyPage.js";
import { GamePage } from "../pages/GamePage/GamePage.js";
import { SettingsPage } from "../pages/SettingsPage/SettingsPage.js";
import { HistoryPage } from "../pages/HistoryPage/HistoryPage.js";
import { HelpPage } from "../pages/HelpPage/HelpPage.js";
import { TutorialPage } from "../pages/TutorialPage/TutorialPage.js";

// GitHub Pages hosting adapter: when the app is built for the project site (base
// `/neko-sudoku-web/`), the router runs under that basename so existing route strings
// ("/play", <Link to="/settings">, navigate("/history"), …) stay unchanged. In dev and at the
// root build, BASE_URL is "/" and basename is undefined — identical to the previous behaviour.
const rawBase = import.meta.env.BASE_URL;
const routerBasename = rawBase && rawBase !== "/" ? rawBase.replace(/\/$/, "") : undefined;

// §6/§28 Routes. Browser Back/Forward/Refresh all behave via the real History API.
const routes = [
  { path: "/", element: <HomePage /> },
  { path: "/new", element: <DifficultyPage /> },
  { path: "/play", element: <GamePage /> },
  { path: "/settings", element: <SettingsPage /> },
  { path: "/history", element: <HistoryPage /> },
  { path: "/help", element: <HelpPage /> },
  { path: "/tutorial", element: <TutorialPage /> },
  // Unknown paths fall back to home rather than white-screening.
  { path: "*", element: <HomePage /> },
];

// Pass `basename` only when running under a project-site base (avoids exactOptionalPropertyTypes
// friction and keeps the dev/root behaviour identical).
export const router = routerBasename
  ? createBrowserRouter(routes, { basename: routerBasename })
  : createBrowserRouter(routes);
