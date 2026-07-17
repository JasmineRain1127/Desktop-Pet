import { FeedingWindow } from "./feeding/FeedingWindow";
import { PetWindow } from "./pet/PetWindow";
import { SettingsWindow } from "./settings/SettingsWindow";

export function App() {
  const windowLabel = getCurrentWindowLabel();

  if (windowLabel === "feeding") {
    return <FeedingWindow />;
  }

  if (windowLabel === "settings") {
    return <SettingsWindow />;
  }

  return <PetWindow />;
}

function getCurrentWindowLabel() {
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

  return tauriInternals?.metadata?.currentWindow?.label ?? "main";
}
