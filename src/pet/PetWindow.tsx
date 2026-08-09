import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  FEEDING_RESULT_EVENT,
  type FeedingResult
} from "../feeding/petFeeding";
import {
  getNextPetAppearanceId,
  petAppearanceConfigs,
  petAppearanceOrder,
  type PetAppearanceId
} from "./petAppearance";
import { petMoodConfigs, petMoodOrder, type PetMood } from "./petMood";
import {
  AUTOMATIC_MOOD_TRANSITION_DELAY_MS,
  advanceAutomaticMoodState,
  formatIdleSeconds,
  initialAutomaticMoodState,
  initialSensorSnapshot,
  shouldDelayAutomaticMoodChange,
  type PetSensorSnapshot
} from "./petSimulation";
import { listenToSensorSnapshots } from "./petSensorBridge";
import {
  defaultAppSettings,
  initializeAppSettings,
  listenToAppSettings,
  updateAppSettings,
  type AppSettings
} from "../settings/appSettings";

type DebugMode = "auto" | "manual";
const DEBUG_PANEL_EVENT = "debug_panel_visibility_changed";
const POSITION_SAVE_DELAY_MS = 350;

export function PetWindow() {
  const [isDebugPanelVisible, setIsDebugPanelVisible] = useState(false);
  const [debugMode, setDebugMode] = useState<DebugMode>("auto");
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings);
  const [manualMood, setManualMood] = useState<PetMood>("idle");
  const [feedingMood, setFeedingMood] = useState<PetMood | null>(null);
  const [sensorSnapshot, setSensorSnapshot] = useState<PetSensorSnapshot>(
    initialSensorSnapshot
  );
  const [automaticMoodState, setAutomaticMoodState] = useState(
    initialAutomaticMoodState
  );
  const automaticMood = automaticMoodState.mood;
  const [displayedAutomaticMood, setDisplayedAutomaticMood] =
    useState<PetMood>(automaticMood);
  const activeMood =
    feedingMood ??
    (debugMode === "manual"
      ? manualMood
      : appSettings.quietMode
        ? "idle"
        : displayedAutomaticMood);
  const moodConfig = petMoodConfigs[activeMood];
  const selectedAppearanceId = appSettings.appearance;
  const appearanceConfig = petAppearanceConfigs[selectedAppearanceId];
  const face = appearanceConfig.faces?.[activeMood] ?? moodConfig.face;
  const appWindow = useMemo(() => (isTauri() ? getCurrentWindow() : null), []);
  const shellClassName = useMemo(
    () =>
      `pet-shell ${appearanceConfig.shellClassName} ${
        isDebugPanelVisible ? "has-debug-panel" : "is-compact"
      } ${appSettings.quietMode ? "is-quiet" : ""} ${moodConfig.className}`,
    [
      appSettings.quietMode,
      appearanceConfig.shellClassName,
      isDebugPanelVisible,
      moodConfig.className
    ]
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
    return listenToSensorSnapshots((snapshot) => {
      setSensorSnapshot(snapshot);
      setAutomaticMoodState((current) =>
        advanceAutomaticMoodState(current, snapshot, Date.now())
      );
    });
  }, []);

  useEffect(() => {
    let disposed = false;

    initializeAppSettings()
      .then(({ settings }) => {
        if (!disposed) {
          setAppSettings(settings);
        }
      })
      .catch((error: unknown) => {
        console.warn("Unable to initialize app settings.", error);
      });

    const stopListening = listenToAppSettings((settings) => {
      if (!disposed) {
        setAppSettings(settings);
      }
    });

    return () => {
      disposed = true;
      stopListening();
    };
  }, []);

  useEffect(() => {
    if (automaticMood === displayedAutomaticMood) {
      return;
    }

    if (!shouldDelayAutomaticMoodChange(displayedAutomaticMood, automaticMood)) {
      setDisplayedAutomaticMood(automaticMood);
      return;
    }

    const transitionTimer = window.setTimeout(() => {
      setDisplayedAutomaticMood(automaticMood);
    }, AUTOMATIC_MOOD_TRANSITION_DELAY_MS);

    return () => {
      window.clearTimeout(transitionTimer);
    };
  }, [automaticMood, displayedAutomaticMood]);

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
    if (!appWindow) {
      return;
    }

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
      if (!appWindow) {
        return;
      }

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

  const chooseAppearance = useCallback((appearance: PetAppearanceId) => {
    updateAppSettings({ appearance })
      .then(setAppSettings)
      .catch((error: unknown) => {
        console.warn("Unable to update pet appearance.", error);
      });
  }, []);

  const cycleAppearance = useCallback(() => {
    chooseAppearance(getNextPetAppearanceId(selectedAppearanceId));
  }, [chooseAppearance, selectedAppearanceId]);

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
      <button
        aria-label={`切换桌宠形象，当前是${appearanceConfig.label}`}
        className="pet-status pet-appearance-cycle"
        onClick={cycleAppearance}
        title="点击切换桌宠形象"
        type="button"
      >
        {appSettings.quietMode ? "安静模式" : moodConfig.label} · {appearanceConfig.label}
      </button>
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
                  onClick={() => chooseAppearance(item)}
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
              <strong>
                {sensorSnapshot.cpuPercent === null
                  ? appSettings.cpuDetectionEnabled && !appSettings.quietMode
                    ? "不可用"
                    : "已关闭"
                  : `${sensorSnapshot.cpuPercent}%`}
              </strong>
            </div>
            <div className="pet-sensor-item">
              <span>打字</span>
              <strong>
                {sensorSnapshot.typingRate === null
                  ? appSettings.typingDetectionEnabled && !appSettings.quietMode
                    ? "不可用"
                    : "已关闭"
                  : `${sensorSnapshot.typingRate}/m`}
              </strong>
            </div>
            <div className="pet-sensor-item">
              <span>空闲</span>
              <strong>
                {sensorSnapshot.idleSeconds === null
                  ? appSettings.idleDetectionEnabled && !appSettings.quietMode
                    ? "不可用"
                    : "已关闭"
                  : formatIdleSeconds(sensorSnapshot.idleSeconds)}
              </strong>
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
