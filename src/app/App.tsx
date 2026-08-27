import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./router.js";
import { persistCurrentGame, useGameStore } from "../stores/gameStore.js";
import { useSettingsStore } from "../stores/settingsStore.js";

// §15/§21 lifecycle: on visibilitychange->hidden, PAUSE the timer first (so background
// time is excluded) THEN persist. On visible, resume. pagehide is a final save fallback.
function useLifecyclePersistence() {
  useEffect(() => {
    const onVisibility = () => {
      const store = useGameStore.getState();
      if (document.visibilityState === "hidden") {
        store.pauseForHidden(); // pauses timer + persists (§15)
      } else if (document.visibilityState === "visible") {
        store.resumeFromVisible();
      }
    };
    const onPageHide = () => {
      useGameStore.getState().pauseForHidden();
      persistCurrentGame();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);
}

export function App() {
  useLifecyclePersistence();
  // Hydrate persisted settings once on mount so large-text applies before first paint of
  // any route (§33) and errorMode is in sync.
  useEffect(() => {
    useSettingsStore.getState().hydrate();
  }, []);
  return <RouterProvider router={router} />;
}
