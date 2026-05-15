import { useMemo, useState } from "react";
import { petMoodConfigs, petMoodOrder, type PetMood } from "./petMood";

export function PetWindow() {
  const [mood, setMood] = useState<PetMood>("idle");
  const moodConfig = petMoodConfigs[mood];
  const shellClassName = useMemo(
    () => `pet-shell ${moodConfig.className}`,
    [moodConfig.className]
  );

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
        {petMoodOrder.map((item) => {
          const itemConfig = petMoodConfigs[item];

          return (
            <button
              aria-pressed={item === mood}
              className="pet-debug-button"
              key={item}
              onClick={() => setMood(item)}
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
