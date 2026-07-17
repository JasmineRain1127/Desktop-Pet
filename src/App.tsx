import { FeedingWindow } from "./feeding/FeedingWindow";
import { PetWindow } from "./pet/PetWindow";
import { SettingsWindow } from "./settings/SettingsWindow";
import { useEffect, useState } from "react";

type AppWindowLabel = "main" | "feeding" | "settings";

export function App() {
  const [windowLabel, setWindowLabel] = useState<AppWindowLabel>(
    getCurrentWindowLabel
  );

  useEffect(() => {
    function updateWindowLabel() {
      setWindowLabel(getCurrentWindowLabel());
    }

    window.addEventListener("hashchange", updateWindowLabel);

    return () => {
      window.removeEventListener("hashchange", updateWindowLabel);
    };
  }, []);

  if (windowLabel === "feeding") {
    return <FeedingWindow />;
  }

  if (windowLabel === "settings") {
    return <SettingsWindow />;
  }

  return <PetWindow />;
}

function getCurrentWindowLabel(): AppWindowLabel {
  const tauriInternals = (
    window as Window & {
      __TAURI_INTERNALS__?: {
        metadata?: {
          currentWindow?: {
            label?: string;
          };
        };
      };
    }
  ).__TAURI_INTERNALS__;
  const tauriWindowLabel = tauriInternals?.metadata?.currentWindow?.label;

  if (isAppWindowLabel(tauriWindowLabel)) {
    return tauriWindowLabel;
  }

  const browserWindowLabel = window.location.hash.replace(/^#\/?/, "");

  if (isAppWindowLabel(browserWindowLabel)) {
    return browserWindowLabel;
  }

  return "main";
}

function isAppWindowLabel(value: unknown): value is AppWindowLabel {
  return value === "main" || value === "feeding" || value === "settings";
}
