mod feeding;
mod sensors;

use std::sync::Mutex;

const MAIN_WINDOW_WIDTH: f64 = 300.0;
const MAIN_WINDOW_COMPACT_HEIGHT: f64 = 220.0;
const MAIN_WINDOW_DEBUG_HEIGHT: f64 = 430.0;
const DEBUG_PANEL_EVENT: &str = "debug_panel_visibility_changed";

struct DebugPanelState {
    visible: Mutex<bool>,
}

#[tauri::command]
fn get_debug_panel_visible(state: tauri::State<'_, DebugPanelState>) -> bool {
    state
        .visible
        .lock()
        .map(|visible| *visible)
        .unwrap_or(false)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(DebugPanelState {
            visible: Mutex::new(false),
        })
        .invoke_handler(tauri::generate_handler![
            feeding::feed_file_path,
            get_debug_panel_visible
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri::menu::{Menu, MenuItem};
                use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
                use tauri::{Manager, WindowEvent};

                let show_item = MenuItem::with_id(app, "show", "显示小怪兽", true, None::<&str>)?;
                let hide_item = MenuItem::with_id(app, "hide", "隐藏小怪兽", true, None::<&str>)?;
                let feed_item = MenuItem::with_id(app, "feed", "投喂", true, None::<&str>)?;
                let debug_item =
                    MenuItem::with_id(app, "debug", "显示调试面板", true, None::<&str>)?;
                let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
                let menu = Menu::with_items(
                    app,
                    &[&show_item, &hide_item, &feed_item, &debug_item, &quit_item],
                )?;
                let debug_item_for_menu = debug_item.clone();

                let _tray = TrayIconBuilder::with_id("main-tray")
                    .tooltip("桌面小怪兽")
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(move |app, event| match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "hide" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.hide();
                            }
                        }
                        "feed" => {
                            if let Err(error) = show_feeding_window(app) {
                                eprintln!("Unable to show feeding window: {error}");
                            }
                        }
                        "debug" => {
                            if let Err(error) = toggle_debug_panel(app, &debug_item_for_menu) {
                                eprintln!("Unable to toggle debug panel: {error}");
                            }
                        }
                        "quit" => app.exit(0),
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let is_visible = window.is_visible().unwrap_or(false);

                                if is_visible {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    })
                    .build(app)?;

                if let Some(window) = app.get_webview_window("main") {
                    window.on_window_event(|event| {
                        if let WindowEvent::CloseRequested { api, .. } = event {
                            api.prevent_close();
                        }
                    });
                }

                sensors::start_sensor_events(app.handle().clone());
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running desktop pet application");
}

#[cfg(desktop)]
fn toggle_debug_panel(
    app: &tauri::AppHandle,
    debug_item: &tauri::menu::MenuItem<tauri::Wry>,
) -> tauri::Result<()> {
    use tauri::{Emitter, LogicalSize, Manager};

    let next_visible = {
        let state = app.state::<DebugPanelState>();
        let mut visible = state
            .visible
            .lock()
            .unwrap_or_else(|error| error.into_inner());

        *visible = !*visible;
        *visible
    };

    debug_item.set_text(if next_visible {
        "隐藏调试面板"
    } else {
        "显示调试面板"
    })?;

    if let Some(window) = app.get_webview_window("main") {
        let height = if next_visible {
            MAIN_WINDOW_DEBUG_HEIGHT
        } else {
            MAIN_WINDOW_COMPACT_HEIGHT
        };

        window.set_size(LogicalSize::new(MAIN_WINDOW_WIDTH, height))?;
        window.emit(DEBUG_PANEL_EVENT, next_visible)?;
    }

    Ok(())
}

#[cfg(desktop)]
fn show_feeding_window(app: &tauri::AppHandle) -> tauri::Result<()> {
    use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

    if let Some(window) = app.get_webview_window("feeding") {
        window.show()?;
        window.set_focus()?;
        return Ok(());
    }

    let window = WebviewWindowBuilder::new(app, "feeding", WebviewUrl::App("index.html".into()))
        .title("投喂小怪兽")
        .inner_size(360.0, 332.0)
        .resizable(false)
        .always_on_top(true)
        .center()
        .build()?;

    window.set_focus()?;
    Ok(())
}
