import { useEffect, useMemo, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  FEEDING_RESULT_EVENT,
  type FeedingResult
} from "../feeding/petFeeding";
import { petMoodConfigs, petMoodOrder, type PetMood } from "./petMood";
import {
  deriveMoodFromSensors,
  formatIdleSeconds,
  initialSensorSnapshot,
  type PetSensorSnapshot
} from "./petSimulation";
import { listenToSensorSnapshots } from "./petSensorBridge";

type DebugMode = "auto" | "manual";

export function PetWindow() {
  const [debugMode, setDebugMode] = useState<DebugMode>("auto");
  const [manualMood, setManualMood] = useState<PetMood>("idle");
  const [feedingMood, setFeedingMood] = useState<PetMood | null>(null);
  const [sensorSnapshot, setSensorSnapshot] = useState<PetSensorSnapshot>(
    initialSensorSnapshot
  );
  const automaticMood = deriveMoodFromSensors(sensorSnapshot);
  const activeMood =
    feedingMood ?? (debugMode === "auto" ? automaticMood : manualMood);
  const moodConfig = petMoodConfigs[activeMood];
  const shellClassName = useMemo(
    () => `pet-shell ${moodConfig.className}`,
    [moodConfig.className]
  );

  useEffect(() => {
    return listenToSensorSnapshots(setSensorSnapshot);
  }, []);

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

  return (
    <main className={shellClassName} aria-label="桌面小怪兽">
      <section className="pet-stage">
        <div className="pet-shadow" />
        <div className="pet-body">
          <div className="pet-ear pet-ear-left" />
          <div className="pet-ear pet-ear-right" />
          <div className="pet-sweat pet-sweat-left" />
          <div className="pet-sweat pet-sweat-right" />
          <div className="pet-sleep-bubble">Z</div>
          <div className="pet-face">{moodConfig.face}</div>
        </div>
      </section>
      <div className="pet-status">{moodConfig.label}</div>
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
        <div className="pet-sensor-grid" aria-label="模拟传感器数据">
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
    </main>
  );
}
