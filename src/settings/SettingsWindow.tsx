import { useEffect, useState } from "react";
import {
  petAppearanceConfigs,
  petAppearanceOrder,
  type PetAppearanceId
} from "../pet/petAppearance";
import {
  defaultAppSettings,
  initializeAppSettings,
  listenToAppSettings,
  resetAppData,
  updateAppSettings,
  type AppSettings,
  type AppSettingsPatch
} from "./appSettings";

export function SettingsWindow() {
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let disposed = false;

    initializeAppSettings()
      .then((nextSettings) => {
        if (!disposed) {
          setSettings(nextSettings);
        }
      })
      .catch((error: unknown) => {
        if (!disposed) {
          setErrorMessage(formatError(error));
        }
      });

    const stopListening = listenToAppSettings((nextSettings) => {
      if (!disposed) {
        setSettings(nextSettings);
        setErrorMessage("");
      }
    });

    return () => {
      disposed = true;
      stopListening();
    };
  }, []);

  async function savePatch(patch: AppSettingsPatch) {
    setIsSaving(true);
    setErrorMessage("");

    try {
      setSettings(await updateAppSettings(patch));
    } catch (error: unknown) {
      setErrorMessage(formatError(error));
    } finally {
      setIsSaving(false);
    }
  }

  function chooseAppearance(appearance: PetAppearanceId) {
    void savePatch({ appearance });
  }

  async function resetEverything() {
    if (!window.confirm("恢复所有默认设置并清除窗口位置？")) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      setSettings(await resetAppData());
    } catch (error: unknown) {
      setErrorMessage(formatError(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="settings-shell" aria-label="小怪兽设置">
      <header className="settings-header">
        <h1>设置</h1>
        <p>所有偏好只保存在这台电脑上</p>
      </header>

      {errorMessage ? (
        <div className="settings-error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <section className="settings-section" aria-labelledby="appearance-heading">
        <div className="settings-section-heading">
          <h2 id="appearance-heading">桌宠形象</h2>
          <span>{isSaving ? "正在保存…" : "立即生效"}</span>
        </div>
        <div className="settings-appearance-grid">
          {petAppearanceOrder.map((appearanceId) => {
            const config = petAppearanceConfigs[appearanceId];
            const isSelected = appearanceId === settings.appearance;

            return (
              <button
                aria-label={`${config.label}${isSelected ? "，当前选择" : ""}`}
                aria-pressed={isSelected}
                className="settings-appearance-card"
                disabled={isSaving}
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

      <SettingsGroup title="行为">
        <SettingsToggle
          checked={settings.quietMode}
          description="暂停系统检测和普通循环动画，投喂仍可使用。"
          disabled={isSaving}
          label="安静模式"
          onChange={(quietMode) => void savePatch({ quietMode })}
        />
        <SettingsToggle
          checked={settings.clickThroughEnabled}
          description="主窗口不再接收鼠标；可随时从托盘关闭。"
          disabled={isSaving}
          label="鼠标穿透"
          onChange={(clickThroughEnabled) => void savePatch({ clickThroughEnabled })}
        />
      </SettingsGroup>

      <SettingsGroup title="检测与隐私">
        <SettingsToggle
          checked={settings.cpuDetectionEnabled}
          description="只读取整体 CPU 使用率。"
          disabled={isSaving}
          label="CPU 使用率"
          onChange={(cpuDetectionEnabled) => void savePatch({ cpuDetectionEnabled })}
        />
        <SettingsToggle
          checked={settings.idleDetectionEnabled}
          description="只读取距上次系统输入的时长。"
          disabled={isSaving}
          label="空闲时间"
          onChange={(idleDetectionEnabled) => void savePatch({ idleDetectionEnabled })}
        />
        <SettingsToggle
          checked={settings.typingDetectionEnabled}
          description="只统计速度，不读取或保存按键内容。"
          disabled={isSaving}
          label="打字速度"
          onChange={(typingDetectionEnabled) => void savePatch({ typingDetectionEnabled })}
        />
      </SettingsGroup>

      <SettingsGroup title="系统">
        <SettingsToggle
          checked={settings.launchAtStartup}
          description="登录电脑后自动启动桌面小怪兽。"
          disabled={isSaving}
          label="开机启动"
          onChange={(launchAtStartup) => void savePatch({ launchAtStartup })}
        />
      </SettingsGroup>

      <section className="settings-section settings-privacy" aria-labelledby="privacy-heading">
        <div className="settings-section-heading">
          <h2 id="privacy-heading">关于与隐私</h2>
        </div>
        <p>
          小怪兽不会读取输入内容或投喂文件正文，也不会上传 CPU、空闲、打字或文件数据。
        </p>
        <button
          className="settings-reset-button"
          disabled={isSaving}
          onClick={() => void resetEverything()}
          type="button"
        >
          恢复默认并清除本地数据
        </button>
      </section>
    </main>
  );
}

function SettingsGroup({
  children,
  title
}: {
  children: React.ReactNode;
  title: string;
}) {
  const headingId = `settings-${title}`;

  return (
    <section className="settings-section" aria-labelledby={headingId}>
      <div className="settings-section-heading">
        <h2 id={headingId}>{title}</h2>
      </div>
      <div className="settings-toggle-list">{children}</div>
    </section>
  );
}

function SettingsToggle({
  checked,
  description,
  disabled,
  label,
  onChange
}: {
  checked: boolean;
  description: string;
  disabled: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="settings-toggle-row">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
        type="checkbox"
      />
    </label>
  );
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
