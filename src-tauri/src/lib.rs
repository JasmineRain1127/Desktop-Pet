mod sensors;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri::menu::{Menu, MenuItem};
                use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
                use tauri::{Manager, WindowEvent};

                let show_item = MenuItem::with_id(app, "show", "显示小怪兽", true, None::<&str>)?;
                let hide_item = MenuItem::with_id(app, "hide", "隐藏小怪兽", true, None::<&str>)?;
                let feed_item = MenuItem::with_id(app, "feed", "投喂", true, None::<&str>)?;
                let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
                let menu =
                    Menu::with_items(app, &[&show_item, &hide_item, &feed_item, &quit_item])?;

                let _tray = TrayIconBuilder::with_id("main-tray")
                    .tooltip("桌面小怪兽")
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id.as_ref() {
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
fn show_feeding_window(app: &tauri::AppHandle) -> tauri::Result<()> {
    use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

    if let Some(window) = app.get_webview_window("feeding") {
        window.show()?;
        window.set_focus()?;
        return Ok(());
    }

    let window = WebviewWindowBuilder::new(app, "feeding", WebviewUrl::App("index.html".into()))
        .title("投喂小怪兽")
        .inner_size(360.0, 292.0)
        .resizable(false)
        .always_on_top(true)
        .center()
        .build()?;

    window.set_focus()?;
    Ok(())
}
