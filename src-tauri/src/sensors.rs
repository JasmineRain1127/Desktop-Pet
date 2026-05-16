use std::{thread, time::Duration};

use serde::Serialize;
use sysinfo::System;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
struct SensorSnapshot {
    cpu_percent: u8,
    typing_rate: u16,
    idle_seconds: u16,
}

const SENSOR_EVENT: &str = "sensor_snapshot";
const MOCK_FRAMES: [SensorSnapshot; 8] = [
    SensorSnapshot {
        cpu_percent: 18,
        typing_rate: 0,
        idle_seconds: 18,
    },
    SensorSnapshot {
        cpu_percent: 42,
        typing_rate: 34,
        idle_seconds: 0,
    },
    SensorSnapshot {
        cpu_percent: 64,
        typing_rate: 58,
        idle_seconds: 0,
    },
    SensorSnapshot {
        cpu_percent: 76,
        typing_rate: 94,
        idle_seconds: 0,
    },
    SensorSnapshot {
        cpu_percent: 92,
        typing_rate: 146,
        idle_seconds: 0,
    },
    SensorSnapshot {
        cpu_percent: 31,
        typing_rate: 8,
        idle_seconds: 135,
    },
    SensorSnapshot {
        cpu_percent: 14,
        typing_rate: 0,
        idle_seconds: 320,
    },
    SensorSnapshot {
        cpu_percent: 26,
        typing_rate: 12,
        idle_seconds: 45,
    },
];

pub fn start_mock_sensor_events(app: AppHandle) {
    thread::spawn(move || {
        let mut frame_index = 0;
        let mut system = System::new();

        system.refresh_cpu_usage();
        thread::sleep(Duration::from_secs(1));

        loop {
            let mock_snapshot = MOCK_FRAMES[frame_index % MOCK_FRAMES.len()];
            let snapshot = SensorSnapshot {
                cpu_percent: read_cpu_percent(&mut system, mock_snapshot.cpu_percent),
                typing_rate: mock_snapshot.typing_rate,
                idle_seconds: read_idle_seconds(mock_snapshot.idle_seconds),
            };

            let _ = app.emit(SENSOR_EVENT, snapshot);

            frame_index += 1;
            thread::sleep(Duration::from_secs(1));
        }
    });
}

fn read_cpu_percent(system: &mut System, fallback_cpu_percent: u8) -> u8 {
    system.refresh_cpu_usage();

    let usage = system.global_cpu_usage();

    if !usage.is_finite() {
        return fallback_cpu_percent;
    }

    usage.round().clamp(0.0, 100.0) as u8
}

fn read_idle_seconds(fallback_idle_seconds: u16) -> u16 {
    platform_idle_seconds().unwrap_or(fallback_idle_seconds)
}

#[cfg(target_os = "macos")]
fn platform_idle_seconds() -> Option<u16> {
    const KCG_EVENT_SOURCE_STATE_COMBINED_SESSION_STATE: u32 = 0;
    const KCG_ANY_INPUT_EVENT_TYPE: u32 = u32::MAX;

    #[link(name = "ApplicationServices", kind = "framework")]
    unsafe extern "C" {
        fn CGEventSourceSecondsSinceLastEventType(state_id: u32, event_type: u32) -> f64;
    }

    let idle_seconds = unsafe {
        CGEventSourceSecondsSinceLastEventType(
            KCG_EVENT_SOURCE_STATE_COMBINED_SESSION_STATE,
            KCG_ANY_INPUT_EVENT_TYPE,
        )
    };

    finite_seconds_to_u16(idle_seconds)
}

#[cfg(target_os = "windows")]
fn platform_idle_seconds() -> Option<u16> {
    use std::mem::size_of;
    use windows::Win32::System::SystemInformation::GetTickCount;
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};

    let mut input_info = LASTINPUTINFO {
        cbSize: size_of::<LASTINPUTINFO>() as u32,
        dwTime: 0,
    };

    if unsafe { GetLastInputInfo(&mut input_info) }.is_err() {
        return None;
    }

    let now_ms = unsafe { GetTickCount() };
    let idle_ms = now_ms.wrapping_sub(input_info.dwTime);

    Some(((idle_ms / 1000).min(u16::MAX as u32)) as u16)
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn platform_idle_seconds() -> Option<u16> {
    None
}

fn finite_seconds_to_u16(seconds: f64) -> Option<u16> {
    if !seconds.is_finite() || seconds.is_sign_negative() {
        return None;
    }

    Some(seconds.round().clamp(0.0, u16::MAX as f64) as u16)
}
