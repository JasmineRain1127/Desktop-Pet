import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  DEFAULT_PET_APPEARANCE_ID,
  isPetAppearanceId,
  PET_APPEARANCE_STORAGE_KEY,
  readStoredAppearanceId,
  saveStoredAppearanceId,
  type PetAppearanceId
} from "../pet/petAppearance";

export const APP_SETTINGS_CHANGED_EVENT = "app_settings_changed";

export type AppSettings = {
  schemaVersion: 1;
  appearance: PetAppearanceId;
  quietMode: boolean;
  cpuDetectionEnabled: boolean;
  idleDetectionEnabled: boolean;
  typingDetectionEnabled: boolean;
  clickThroughEnabled: boolean;
  launchAtStartup: boolean;
};

export type AppSettingsPatch = Partial<Omit<AppSettings, "schemaVersion">>;

type AppSettingsEnvelope = {
  settings: AppSettings;
  persisted: boolean;
  warning: string | null;
};

export type AppSettingsInitialization = {
  settings: AppSettings;
  warning: string | null;
};

export const defaultAppSettings: AppSettings = {
  schemaVersion: 1,
  appearance: DEFAULT_PET_APPEARANCE_ID,
  quietMode: false,
  cpuDetectionEnabled: true,
  idleDetectionEnabled: true,
  typingDetectionEnabled: true,
  clickThroughEnabled: false,
  launchAtStartup: false
};

let browserSettings: AppSettings | undefined;

export async function initializeAppSettings(): Promise<AppSettingsInitialization> {
  if (!isTauri()) {
    return { settings: getBrowserSettings(), warning: null };
  }

  const envelope = await invoke<AppSettingsEnvelope>("get_app_settings");

  if (envelope.persisted) {
    clearLegacyAppearance();
    return { settings: envelope.settings, warning: envelope.warning };
  }

  if (envelope.warning) {
    return { settings: envelope.settings, warning: envelope.warning };
  }

  const legacyAppearance = readStoredAppearanceId();
  const settings = await updateAppSettings({ appearance: legacyAppearance });
  clearLegacyAppearance();
  return { settings, warning: null };
}

export async function updateAppSettings(
  patch: AppSettingsPatch
): Promise<AppSettings> {
  if (!isTauri()) {
    const next = {
      ...getBrowserSettings(),
      ...patch,
      schemaVersion: 1
    } as AppSettings;

    browserSettings = next;
    saveStoredAppearanceId(next.appearance);
    return next;
  }

  return invoke<AppSettings>("update_app_settings", { patch });
}

export async function resetAppData(): Promise<AppSettings> {
  if (!isTauri()) {
    browserSettings = { ...defaultAppSettings };
    saveStoredAppearanceId(DEFAULT_PET_APPEARANCE_ID);
    return browserSettings;
  }

  const settings = await invoke<AppSettings>("reset_app_data");
  clearLegacyAppearance();
  return settings;
}

export function listenToAppSettings(
  onSettings: (settings: AppSettings) => void
) {
  if (!isTauri()) {
    function handleStorage(event: StorageEvent) {
      if (
        event.key === PET_APPEARANCE_STORAGE_KEY &&
        event.newValue &&
        isPetAppearanceId(event.newValue)
      ) {
        onSettings({
          ...defaultAppSettings,
          appearance: event.newValue
        });
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }

  let disposed = false;
  let unlisten: UnlistenFn | undefined;

  listen<AppSettings>(APP_SETTINGS_CHANGED_EVENT, (event) => {
    onSettings(event.payload);
  })
    .then((nextUnlisten) => {
      if (disposed) {
        nextUnlisten();
        return;
      }

      unlisten = nextUnlisten;
    })
    .catch((error: unknown) => {
      console.warn("Unable to listen for app settings.", error);
    });

  return () => {
    disposed = true;
    unlisten?.();
  };
}

function clearLegacyAppearance() {
  try {
    window.localStorage.removeItem(PET_APPEARANCE_STORAGE_KEY);
  } catch (error: unknown) {
    console.warn("Unable to clear legacy pet appearance.", error);
  }
}

function getBrowserSettings() {
  browserSettings ??= {
    ...defaultAppSettings,
    appearance: readStoredAppearanceId()
  };
  return { ...browserSettings };
}
