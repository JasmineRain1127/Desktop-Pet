use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::window_position;

const SETTINGS_FILE_NAME: &str = "app-settings.json";
pub const SETTINGS_CHANGED_EVENT: &str = "app_settings_changed";

#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PetAppearance {
    #[default]
    Monster,
    Cat,
    Dog,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AppSettings {
    pub schema_version: u16,
    pub appearance: PetAppearance,
    pub quiet_mode: bool,
    pub cpu_detection_enabled: bool,
    pub idle_detection_enabled: bool,
    pub typing_detection_enabled: bool,
    pub click_through_enabled: bool,
    pub launch_at_startup: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            schema_version: 1,
            appearance: PetAppearance::Monster,
            quiet_mode: false,
            cpu_detection_enabled: true,
            idle_detection_enabled: true,
            typing_detection_enabled: true,
            click_through_enabled: false,
            launch_at_startup: false,
        }
    }
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AppSettingsPatch {
    appearance: Option<PetAppearance>,
    quiet_mode: Option<bool>,
    cpu_detection_enabled: Option<bool>,
    idle_detection_enabled: Option<bool>,
    typing_detection_enabled: Option<bool>,
    click_through_enabled: Option<bool>,
    launch_at_startup: Option<bool>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettingsEnvelope {
    settings: AppSettings,
    persisted: bool,
    warning: Option<String>,
}

pub struct AppSettingsState {
    settings: Mutex<AppSettings>,
    persisted: Mutex<bool>,
    warning: Mutex<Option<String>>,
}

#[cfg(desktop)]
pub struct SettingsMenuItems {
    quiet: tauri::menu::MenuItem<tauri::Wry>,
    click_through: tauri::menu::MenuItem<tauri::Wry>,
}

#[cfg(desktop)]
impl SettingsMenuItems {
    pub fn new(
        quiet: tauri::menu::MenuItem<tauri::Wry>,
        click_through: tauri::menu::MenuItem<tauri::Wry>,
    ) -> Self {
        Self {
            quiet,
            click_through,
        }
    }
}

impl Default for AppSettingsState {
    fn default() -> Self {
        Self {
            settings: Mutex::new(AppSettings::default()),
            persisted: Mutex::new(false),
            warning: Mutex::new(None),
        }
    }
}

pub fn initialize(app: &AppHandle) {
    let state = app.state::<AppSettingsState>();
    let path = match settings_file_path(app) {
        Ok(path) => path,
        Err(error) => {
            eprintln!("Unable to resolve app settings path: {error}");
            return;
        }
    };

    let (mut settings, persisted, warning) = match read_settings_file(&path) {
        Ok(Some(settings)) => (settings, true, None),
        Ok(None) => (AppSettings::default(), false, None),
        Err(error) => {
            eprintln!("Unable to read app settings: {error}");
            (
                AppSettings::default(),
                false,
                Some("本机设置文件无效，已临时使用默认设置；保存任意设置即可修复。".to_string()),
            )
        }
    };

    settings.schema_version = 1;

    #[cfg(desktop)]
    {
        use tauri_plugin_autostart::ManagerExt;

        if let Ok(is_enabled) = app.autolaunch().is_enabled() {
            settings.launch_at_startup = is_enabled;
        }
    }

    if let Ok(mut current) = state.settings.lock() {
        *current = settings.clone();
    }
    if let Ok(mut is_persisted) = state.persisted.lock() {
        *is_persisted = persisted;
    }
    if let Ok(mut current_warning) = state.warning.lock() {
        *current_warning = warning;
    }

    if let Err(error) = apply_click_through(app, settings.click_through_enabled) {
        eprintln!("Unable to restore click-through setting: {error}");
    }
    sync_menu_labels(app, &settings);
}

pub fn current_settings(app: &AppHandle) -> AppSettings {
    app.state::<AppSettingsState>()
        .settings
        .lock()
        .map(|settings| settings.clone())
        .unwrap_or_default()
}

#[tauri::command]
pub fn get_app_settings(app: AppHandle) -> AppSettingsEnvelope {
    let state = app.state::<AppSettingsState>();
    let settings = state
        .settings
        .lock()
        .map(|settings| settings.clone())
        .unwrap_or_default();
    let persisted = state
        .persisted
        .lock()
        .map(|persisted| *persisted)
        .unwrap_or(false);
    let warning = state
        .warning
        .lock()
        .map(|warning| warning.clone())
        .unwrap_or(None);

    AppSettingsEnvelope {
        settings,
        persisted,
        warning,
    }
}

#[tauri::command]
pub fn update_app_settings(app: AppHandle, patch: AppSettingsPatch) -> Result<AppSettings, String> {
    update_settings(&app, patch)
}

#[tauri::command]
pub fn reset_app_data(app: AppHandle) -> Result<AppSettings, String> {
    let current = current_settings(&app);
    let defaults = AppSettings::default();

    apply_autostart(&app, defaults.launch_at_startup)?;
    if let Err(error) = apply_click_through(&app, defaults.click_through_enabled) {
        let _ = apply_autostart(&app, current.launch_at_startup);
        return Err(error);
    }

    persist_settings(&app, &defaults)?;
    set_current_settings(&app, defaults.clone(), true);
    set_warning(&app, None);
    window_position::reset_main_window_position(&app)
        .map_err(|error| format!("无法重置窗口位置：{error}"))?;
    sync_menu_labels(&app, &defaults);
    emit_settings(&app, &defaults);

    Ok(defaults)
}

pub fn toggle_quiet_mode(app: &AppHandle) -> Result<AppSettings, String> {
    let current = current_settings(app);
    update_settings(
        app,
        AppSettingsPatch {
            quiet_mode: Some(!current.quiet_mode),
            ..AppSettingsPatch::default()
        },
    )
}

pub fn toggle_click_through(app: &AppHandle) -> Result<AppSettings, String> {
    let current = current_settings(app);
    update_settings(
        app,
        AppSettingsPatch {
            click_through_enabled: Some(!current.click_through_enabled),
            ..AppSettingsPatch::default()
        },
    )
}

fn update_settings(app: &AppHandle, patch: AppSettingsPatch) -> Result<AppSettings, String> {
    let current = current_settings(app);
    let next = apply_settings_patch(&current, patch);

    if next.launch_at_startup != current.launch_at_startup {
        apply_autostart(app, next.launch_at_startup)?;
    }

    if next.click_through_enabled != current.click_through_enabled {
        if let Err(error) = apply_click_through(app, next.click_through_enabled) {
            if next.launch_at_startup != current.launch_at_startup {
                let _ = apply_autostart(app, current.launch_at_startup);
            }
            return Err(error);
        }
    }

    if let Err(error) = persist_settings(app, &next) {
        if next.click_through_enabled != current.click_through_enabled {
            let _ = apply_click_through(app, current.click_through_enabled);
        }
        if next.launch_at_startup != current.launch_at_startup {
            let _ = apply_autostart(app, current.launch_at_startup);
        }
        return Err(error);
    }

    set_current_settings(app, next.clone(), true);
    set_warning(app, None);
    sync_menu_labels(app, &next);
    emit_settings(app, &next);

    Ok(next)
}

fn apply_settings_patch(current: &AppSettings, patch: AppSettingsPatch) -> AppSettings {
    let mut next = current.clone();

    if let Some(value) = patch.appearance {
        next.appearance = value;
    }
    if let Some(value) = patch.quiet_mode {
        next.quiet_mode = value;
    }
    if let Some(value) = patch.cpu_detection_enabled {
        next.cpu_detection_enabled = value;
    }
    if let Some(value) = patch.idle_detection_enabled {
        next.idle_detection_enabled = value;
    }
    if let Some(value) = patch.typing_detection_enabled {
        next.typing_detection_enabled = value;
    }
    if let Some(value) = patch.click_through_enabled {
        next.click_through_enabled = value;
    }
    if let Some(value) = patch.launch_at_startup {
        next.launch_at_startup = value;
    }
    next.schema_version = 1;

    next
}

fn set_current_settings(app: &AppHandle, settings: AppSettings, persisted: bool) {
    let state = app.state::<AppSettingsState>();

    if let Ok(mut current) = state.settings.lock() {
        *current = settings;
    }
    if let Ok(mut is_persisted) = state.persisted.lock() {
        *is_persisted = persisted;
    };
}

fn set_warning(app: &AppHandle, warning: Option<String>) {
    let state = app.state::<AppSettingsState>();

    if let Ok(mut current_warning) = state.warning.lock() {
        *current_warning = warning;
    };
}

fn emit_settings(app: &AppHandle, settings: &AppSettings) {
    if let Err(error) = app.emit(SETTINGS_CHANGED_EVENT, settings.clone()) {
        eprintln!("Unable to emit app settings: {error}");
    }
}

#[cfg(desktop)]
fn sync_menu_labels(app: &AppHandle, settings: &AppSettings) {
    let Some(items) = app.try_state::<SettingsMenuItems>() else {
        return;
    };

    let _ = items.quiet.set_text(if settings.quiet_mode {
        "退出安静模式"
    } else {
        "进入安静模式"
    });
    let _ = items
        .click_through
        .set_text(if settings.click_through_enabled {
            "关闭鼠标穿透"
        } else {
            "开启鼠标穿透"
        });
}

#[cfg(not(desktop))]
fn sync_menu_labels(_app: &AppHandle, _settings: &AppSettings) {}

fn persist_settings(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    let path = settings_file_path(app).map_err(|error| format!("无法定位配置目录：{error}"))?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("无法创建配置目录：{error}"))?;
    }

    let content = serde_json::to_string_pretty(settings)
        .map_err(|error| format!("无法序列化应用设置：{error}"))?;
    fs::write(path, content).map_err(|error| format!("无法保存应用设置：{error}"))
}

fn read_settings_file(path: &PathBuf) -> Result<Option<AppSettings>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let settings =
        serde_json::from_str::<AppSettings>(&content).map_err(|error| error.to_string())?;

    Ok(Some(settings))
}

fn settings_file_path(app: &AppHandle) -> tauri::Result<PathBuf> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join(SETTINGS_FILE_NAME))
}

fn apply_click_through(app: &AppHandle, enabled: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window
            .set_ignore_cursor_events(enabled)
            .map_err(|error| format!("无法更新鼠标穿透：{error}"))?;
    }

    Ok(())
}

#[cfg(desktop)]
fn apply_autostart(app: &AppHandle, enabled: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;

    if enabled {
        app.autolaunch().enable()
    } else {
        app.autolaunch().disable()
    }
    .map_err(|error| format!("无法更新开机启动：{error}"))
}

#[cfg(not(desktop))]
fn apply_autostart(_app: &AppHandle, _enabled: bool) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_privacy_explicit_and_versioned() {
        let settings = AppSettings::default();

        assert_eq!(settings.schema_version, 1);
        assert_eq!(settings.appearance, PetAppearance::Monster);
        assert!(!settings.quiet_mode);
        assert!(settings.cpu_detection_enabled);
        assert!(settings.idle_detection_enabled);
        assert!(settings.typing_detection_enabled);
        assert!(!settings.click_through_enabled);
        assert!(!settings.launch_at_startup);
    }

    #[test]
    fn old_partial_json_receives_current_defaults() {
        let settings: AppSettings = serde_json::from_str(r#"{"appearance":"cat"}"#).unwrap();

        assert_eq!(settings.schema_version, 1);
        assert_eq!(settings.appearance, PetAppearance::Cat);
        assert!(settings.cpu_detection_enabled);
        assert!(settings.idle_detection_enabled);
        assert!(settings.typing_detection_enabled);
    }

    #[test]
    fn patch_only_changes_supplied_fields_and_normalizes_version() {
        let current = AppSettings {
            schema_version: 99,
            appearance: PetAppearance::Dog,
            quiet_mode: false,
            cpu_detection_enabled: false,
            ..AppSettings::default()
        };
        let patch: AppSettingsPatch =
            serde_json::from_str(r#"{"quietMode":true,"clickThroughEnabled":true}"#).unwrap();

        let next = apply_settings_patch(&current, patch);

        assert_eq!(next.schema_version, 1);
        assert_eq!(next.appearance, PetAppearance::Dog);
        assert!(next.quiet_mode);
        assert!(!next.cpu_detection_enabled);
        assert!(next.click_through_enabled);
    }

    #[test]
    fn patch_rejects_unknown_fields() {
        let result = serde_json::from_str::<AppSettingsPatch>(r#"{"surprise":true}"#);

        assert!(result.is_err());
    }
}
