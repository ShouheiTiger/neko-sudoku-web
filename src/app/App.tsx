import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./router.js";
import { persistCurrentGame } from "../stores/gameStore.js";

// §21 fallback persistence: save on visibilitychange->hidden and pagehide.
// We intentionally do NOT rely solely on beforeunload.
function useLifecyclePersistence() {
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") persistCurrentGame();
    };
    const onPageHide = () => persistCurrentGame();
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);
}

export function App() {
  useLifecyclePersistence();
  return <RouterProvider router={router} />;
}
