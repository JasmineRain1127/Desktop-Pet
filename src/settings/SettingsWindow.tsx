import { useState } from "react";
import {
  petAppearanceConfigs,
  petAppearanceOrder,
  readStoredAppearanceId,
  saveStoredAppearanceId,
  type PetAppearanceId
} from "../pet/petAppearance";

export function SettingsWindow() {
  const [selectedAppearanceId, setSelectedAppearanceId] =
    useState<PetAppearanceId>(readStoredAppearanceId);

  function chooseAppearance(appearanceId: PetAppearanceId) {
    setSelectedAppearanceId(appearanceId);
    saveStoredAppearanceId(appearanceId);
  }

  return (
    <main className="settings-shell" aria-label="小怪兽设置">
      <header className="settings-header">
        <h1>设置</h1>
        <p>选择桌宠形象</p>
      </header>
      <section className="settings-section" aria-label="桌宠形象">
        <div className="settings-appearance-grid">
          {petAppearanceOrder.map((appearanceId) => {
            const config = petAppearanceConfigs[appearanceId];
            const isSelected = appearanceId === selectedAppearanceId;

            return (
              <button
                aria-label={`${config.label}${isSelected ? "，当前选择" : ""}`}
                aria-pressed={isSelected}
                className="settings-appearance-card"
                key={appearanceId}
                onClick={() => chooseAppearance(appearanceId)}
                type="button"
              >
                <span className={`settings-appearance-preview ${config.shellClassName}`}>
                  <span className="settings-appearance-face">
                    {config.faces?.idle ?? "•ᴗ•"}
                  </span>
                </span>
                <strong>{config.label}</strong>
                <span className="settings-appearance-state">
                  {isSelected ? "已选择" : "可选择"}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
