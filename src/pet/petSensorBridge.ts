import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { PetSensorSnapshot } from "./petSimulation";

const SENSOR_EVENT = "sensor_snapshot";

export function listenToSensorSnapshots(
  onSnapshot: (snapshot: PetSensorSnapshot) => void
) {
  let disposed = false;
  let unlisten: UnlistenFn | undefined;

  listen<PetSensorSnapshot>(SENSOR_EVENT, (event) => {
    onSnapshot(event.payload);
  })
    .then((nextUnlisten) => {
      if (disposed) {
        nextUnlisten();
        return;
      }

      unlisten = nextUnlisten;
    })
    .catch((error: unknown) => {
      console.warn("Unable to listen for sensor snapshots.", error);
    });

  return () => {
    disposed = true;
    unlisten?.();
  };
}
