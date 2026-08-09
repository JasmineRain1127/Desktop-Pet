use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

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
            if saved_position_is_visible(window, position) {
                if let Err(error) =
                    window.set_position(PhysicalPosition::new(position.x, position.y))
                {
                    eprintln!("Unable to restore main window position: {error}");
                }
            } else if let Err(error) = window.center() {
                eprintln!("Unable to center main window after display change: {error}");
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

#[derive(Clone, Copy)]
struct ScreenBounds {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

fn saved_position_is_visible(window: &WebviewWindow, position: SavedWindowPosition) -> bool {
    let window_size = window
        .outer_size()
        .unwrap_or_else(|_| PhysicalSize::new(300, 220));
    let monitors = match window.available_monitors() {
        Ok(monitors) => monitors
            .into_iter()
            .map(|monitor| ScreenBounds {
                x: monitor.position().x,
                y: monitor.position().y,
                width: monitor.size().width,
                height: monitor.size().height,
            })
            .collect::<Vec<_>>(),
        Err(error) => {
            eprintln!("Unable to inspect displays before restoring window: {error}");
            return false;
        }
    };

    window_center_is_on_screen(position, window_size, &monitors)
}

fn window_center_is_on_screen(
    position: SavedWindowPosition,
    window_size: PhysicalSize<u32>,
    monitors: &[ScreenBounds],
) -> bool {
    let center_x = i64::from(position.x) + i64::from(window_size.width / 2);
    let center_y = i64::from(position.y) + i64::from(window_size.height / 2);

    monitors.iter().any(|monitor| {
        let left = i64::from(monitor.x);
        let top = i64::from(monitor.y);
        let right = left + i64::from(monitor.width);
        let bottom = top + i64::from(monitor.height);

        (left..right).contains(&center_x) && (top..bottom).contains(&center_y)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const WINDOW_SIZE: PhysicalSize<u32> = PhysicalSize::new(300, 220);

    #[test]
    fn accepts_window_center_on_primary_display() {
        let monitors = [ScreenBounds {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        }];

        assert!(window_center_is_on_screen(
            SavedWindowPosition { x: 1620, y: 860 },
            WINDOW_SIZE,
            &monitors,
        ));
    }

    #[test]
    fn accepts_negative_coordinates_on_secondary_display() {
        let monitors = [
            ScreenBounds {
                x: -1280,
                y: 0,
                width: 1280,
                height: 1024,
            },
            ScreenBounds {
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
            },
        ];

        assert!(window_center_is_on_screen(
            SavedWindowPosition { x: -1100, y: 120 },
            WINDOW_SIZE,
            &monitors,
        ));
    }

    #[test]
    fn rejects_position_after_display_is_removed() {
        let monitors = [ScreenBounds {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        }];

        assert!(!window_center_is_on_screen(
            SavedWindowPosition { x: -1100, y: 120 },
            WINDOW_SIZE,
            &monitors,
        ));
    }

    #[test]
    fn rejects_empty_monitor_list() {
        assert!(!window_center_is_on_screen(
            SavedWindowPosition { x: 100, y: 100 },
            WINDOW_SIZE,
            &[],
        ));
    }
}
