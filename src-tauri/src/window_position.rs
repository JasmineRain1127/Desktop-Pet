use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, PhysicalPosition, WebviewWindow};

const POSITION_FILE_NAME: &str = "main-window-position.json";
const MIN_COORDINATE: i32 = -32_000;
const MAX_COORDINATE: i32 = 32_000;

#[derive(Clone, Copy, Deserialize, Serialize)]
struct SavedWindowPosition {
    x: i32,
    y: i32,
}

#[tauri::command]
pub fn save_main_window_position(app: AppHandle, x: i32, y: i32) -> Result<(), String> {
    if !is_reasonable_coordinate(x) || !is_reasonable_coordinate(y) {
        return Err("窗口坐标超出可保存范围".to_string());
    }

    let path = position_file_path(&app).map_err(|error| format!("无法定位配置目录：{error}"))?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("无法创建配置目录：{error}"))?;
    }

    let position = SavedWindowPosition { x, y };
    let content =
        serde_json::to_string(&position).map_err(|error| format!("无法序列化窗口位置：{error}"))?;

    fs::write(path, content).map_err(|error| format!("无法保存窗口位置：{error}"))
}

#[cfg(desktop)]
pub fn restore_main_window_position(app: &AppHandle, window: &WebviewWindow) {
    match read_saved_position(app) {
        Ok(Some(position)) => {
            if let Err(error) = window.set_position(PhysicalPosition::new(position.x, position.y)) {
                eprintln!("Unable to restore main window position: {error}");
            }
        }
        Ok(None) => {}
        Err(error) => eprintln!("Unable to read main window position: {error}"),
    }
}

#[cfg(desktop)]
pub fn reset_main_window_position(app: &AppHandle) -> tauri::Result<()> {
    clear_saved_position(app);

    if let Some(window) = app.get_webview_window("main") {
        window.center()?;
        window.show()?;
        window.set_focus()?;
    }

    Ok(())
}

fn read_saved_position(app: &AppHandle) -> Result<Option<SavedWindowPosition>, String> {
    let path = position_file_path(app).map_err(|error| format!("无法定位配置目录：{error}"))?;

    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(path).map_err(|error| format!("无法读取窗口位置：{error}"))?;
    let position = serde_json::from_str::<SavedWindowPosition>(&content)
        .map_err(|error| format!("窗口位置配置无效：{error}"))?;

    if is_reasonable_coordinate(position.x) && is_reasonable_coordinate(position.y) {
        Ok(Some(position))
    } else {
        Ok(None)
    }
}

fn clear_saved_position(app: &AppHandle) {
    match position_file_path(app) {
        Ok(path) if path.exists() => {
            if let Err(error) = fs::remove_file(path) {
                eprintln!("Unable to clear main window position: {error}");
            }
        }
        Ok(_) => {}
        Err(error) => eprintln!("Unable to resolve main window position path: {error}"),
    }
}

fn position_file_path(app: &AppHandle) -> tauri::Result<PathBuf> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join(POSITION_FILE_NAME))
}

fn is_reasonable_coordinate(value: i32) -> bool {
    (MIN_COORDINATE..=MAX_COORDINATE).contains(&value)
}
