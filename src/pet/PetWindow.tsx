import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  FEEDING_RESULT_EVENT,
  type FeedingResult
} from "../feeding/petFeeding";
import {
  DEFAULT_PET_APPEARANCE_ID,
  isPetAppearanceId,
  petAppearanceConfigs,
  petAppearanceOrder,
  type PetAppearanceId
} from "./petAppearance";
import { petMoodConfigs, petMoodOrder, type PetMood } from "./petMood";
import {
  deriveMoodFromSensors,
  formatIdleSeconds,
  initialSensorSnapshot,
  type PetSensorSnapshot
} from "./petSimulation";
import { listenToSensorSnapshots } from "./petSensorBridge";

type DebugMode = "auto" | "manual";
const DEBUG_PANEL_EVENT = "debug_panel_visibility_changed";
const POSITION_SAVE_DELAY_MS = 350;
const APPEARANCE_STORAGE_KEY = "desktop-pet-appearance";

function readStoredAppearanceId(): PetAppearanceId {
  try {
    const storedValue = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);

    if (storedValue && isPetAppearanceId(storedValue)) {
      return storedValue;
    }
  } catch (error: unknown) {
    console.warn("Unable to read pet appearance.", error);
  }

  return DEFAULT_PET_APPEARANCE_ID;
}

export function PetWindow() {
  const [isDebugPanelVisible, setIsDebugPanelVisible] = useState(false);
  const [debugMode, setDebugMode] = useState<DebugMode>("auto");
  const [selectedAppearanceId, setSelectedAppearanceId] =
    useState<PetAppearanceId>(readStoredAppearanceId);
  const [manualMood, setManualMood] = useState<PetMood>("idle");
  const [feedingMood, setFeedingMood] = useState<PetMood | null>(null);
  const [sensorSnapshot, setSensorSnapshot] = useState<PetSensorSnapshot>(
    initialSensorSnapshot
  );
  const automaticMood = deriveMoodFromSensors(sensorSnapshot);
  const activeMood =
    feedingMood ?? (debugMode === "auto" ? automaticMood : manualMood);
  const moodConfig = petMoodConfigs[activeMood];
  const appearanceConfig = petAppearanceConfigs[selectedAppearanceId];
  const face = appearanceConfig.faces?.[activeMood] ?? moodConfig.face;
  const appWindow = useMemo(() => getCurrentWindow(), []);
  const shellClassName = useMemo(
    () =>
      `pet-shell ${appearanceConfig.shellClassName} ${
        isDebugPanelVisible ? "has-debug-panel" : "is-compact"
      } ${moodConfig.className}`,
    [appearanceConfig.shellClassName, isDebugPanelVisible, moodConfig.className]
  );

  useEffect(() => {
    let disposed = false;

    invoke<boolean>("get_debug_panel_visible")
      .then((visible) => {
        if (!disposed) {
          setIsDebugPanelVisible(visible);
        }
      })
      .catch((error: unknown) => {
        console.warn("Unable to read debug panel visibility.", error);
      });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    return listenToSensorSnapshots(setSensorSnapshot);
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: UnlistenFn | undefined;

    listen<boolean>(DEBUG_PANEL_EVENT, (event) => {
      setIsDebugPanelVisible(event.payload);
    })
      .then((nextUnlisten) => {
        if (disposed) {
          nextUnlisten();
          return;
        }

        unlisten = nextUnlisten;
      })
      .catch((error: unknown) => {
        console.warn("Unable to listen for debug panel visibility.", error);
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!isDebugPanelVisible) {
      setDebugMode("auto");
    }
  }, [isDebugPanelVisible]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        APPEARANCE_STORAGE_KEY,
        selectedAppearanceId
      );
    } catch (error: unknown) {
      console.warn("Unable to save pet appearance.", error);
    }
  }, [selectedAppearanceId]);

  useEffect(() => {
    let disposed = false;
    let unlisten: UnlistenFn | undefined;
    let saveTimer: number | undefined;

    appWindow
      .onMoved((event) => {
        window.clearTimeout(saveTimer);

        saveTimer = window.setTimeout(() => {
          const { x, y } = event.payload;

          invoke("save_main_window_position", { x, y }).catch(
            (error: unknown) => {
              console.warn("Unable to save main window position.", error);
            }
          );
        }, POSITION_SAVE_DELAY_MS);
      })
      .then((nextUnlisten) => {
        if (disposed) {
          nextUnlisten();
          return;
        }

        unlisten = nextUnlisten;
      })
      .catch((error: unknown) => {
        console.warn("Unable to listen for window movement.", error);
      });

    return () => {
      disposed = true;
      window.clearTimeout(saveTimer);
      unlisten?.();
    };
  }, [appWindow]);

  useEffect(() => {
    let disposed = false;
    let unlisten: UnlistenFn | undefined;
    let eatingTimer: number | undefined;
    let resetTimer: number | undefined;

    listen<FeedingResult>(FEEDING_RESULT_EVENT, (event) => {
      window.clearTimeout(eatingTimer);
      window.clearTimeout(resetTimer);
      setFeedingMood("eating");

      eatingTimer = window.setTimeout(() => {
        setFeedingMood(event.payload.reactionMood);
      }, 850);

      resetTimer = window.setTimeout(() => {
        setFeedingMood(null);
      }, 2600);
    })
      .then((nextUnlisten) => {
        if (disposed) {
          nextUnlisten();
          return;
        }

        unlisten = nextUnlisten;
      })
      .catch((error: unknown) => {
        console.warn("Unable to listen for feeding results.", error);
      });

    return () => {
      disposed = true;
      window.clearTimeout(eatingTimer);
      window.clearTimeout(resetTimer);
      unlisten?.();
    };
  }, []);

  const startWindowDrag = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();

      appWindow.startDragging().catch((error: unknown) => {
        console.warn("Unable to start window drag.", error);
      });
    },
    [appWindow]
  );

  return (
    <main className={shellClassName} aria-label={appearanceConfig.windowLabel}>
      <section
        className="pet-stage"
        data-tauri-drag-region
        onMouseDown={startWindowDrag}
        aria-label={appearanceConfig.dragLabel}
      >
        <div className="pet-shadow" data-tauri-drag-region />
        <div className="pet-body" data-tauri-drag-region>
          <div className="pet-ear pet-ear-left" data-tauri-drag-region />
          <div className="pet-ear pet-ear-right" data-tauri-drag-region />
          <div className="pet-sweat pet-sweat-left" data-tauri-drag-region />
          <div className="pet-sweat pet-sweat-right" data-tauri-drag-region />
          <div className="pet-sleep-bubble" data-tauri-drag-region>
            Z
          </div>
          <div className="pet-face" data-tauri-drag-region>
            {face}
          </div>
        </div>
      </section>
      <div className="pet-status">{moodConfig.label}</div>
      {isDebugPanelVisible ? (
        <section className="pet-debug-panel" aria-label="心情调试面板">
          <div className="pet-mode-toggle" aria-label="心情控制模式">
            <button
              aria-pressed={debugMode === "auto"}
              className="pet-mode-button"
              onClick={() => setDebugMode("auto")}
              type="button"
            >
              自动模式
            </button>
            <button
              aria-pressed={debugMode === "manual"}
              className="pet-mode-button"
              onClick={() => setDebugMode("manual")}
              type="button"
            >
              手动模式
            </button>
          </div>
          <div className="pet-appearance-toggle" aria-label="形象选择">
            {petAppearanceOrder.map((item) => {
              const itemConfig = petAppearanceConfigs[item];

              return (
                <button
                  aria-pressed={item === selectedAppearanceId}
                  className="pet-appearance-button"
                  key={item}
                  onClick={() => setSelectedAppearanceId(item)}
                  type="button"
                >
                  {itemConfig.label}
                </button>
              );
            })}
          </div>
          <div className="pet-sensor-grid" aria-label="传感器数据">
            <div className="pet-sensor-item">
              <span>CPU</span>
              <strong>{sensorSnapshot.cpuPercent}%</strong>
            </div>
            <div className="pet-sensor-item">
              <span>打字</span>
              <strong>{sensorSnapshot.typingRate}/m</strong>
            </div>
            <div className="pet-sensor-item">
              <span>空闲</span>
              <strong>{formatIdleSeconds(sensorSnapshot.idleSeconds)}</strong>
            </div>
          </div>
          {petMoodOrder.map((item) => {
            const itemConfig = petMoodConfigs[item];
            const isPressed = item === activeMood;
            const isDisabled = debugMode === "auto";

            return (
              <button
                aria-pressed={isPressed}
                className="pet-debug-button"
                disabled={isDisabled}
                key={item}
                onClick={() => setManualMood(item)}
                type="button"
              >
                {itemConfig.label}
              </button>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}
