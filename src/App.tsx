import { FeedingWindow } from "./feeding/FeedingWindow";
import { PetWindow } from "./pet/PetWindow";

export function App() {
  return getCurrentWindowLabel() === "feeding" ? <FeedingWindow /> : <PetWindow />;
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
