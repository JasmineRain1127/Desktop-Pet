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

pub fn start_sensor_events(app: AppHandle) {
    thread::spawn(move || {
        let mut frame_index = 0;
        let mut system = System::new();
        let mut typing_sampler = TypingSampler::new();

        system.refresh_cpu_usage();
        thread::sleep(Duration::from_secs(1));

        loop {
            let mock_snapshot = MOCK_FRAMES[frame_index % MOCK_FRAMES.len()];
            let snapshot = SensorSnapshot {
                cpu_percent: read_cpu_percent(&mut system, mock_snapshot.cpu_percent),
                typing_rate: typing_sampler
                    .read_typing_rate()
                    .unwrap_or(mock_snapshot.typing_rate),
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

    if !unsafe { GetLastInputInfo(&mut input_info) }.as_bool() {
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

struct TypingSampler {
    #[cfg(target_os = "macos")]
    previous_key_count: Option<u64>,
    #[cfg(target_os = "windows")]
    previous_pressed_keys: [bool; 256],
}

impl TypingSampler {
    fn new() -> Self {
        Self {
            #[cfg(target_os = "macos")]
            previous_key_count: None,
            #[cfg(target_os = "windows")]
            previous_pressed_keys: [false; 256],
        }
    }

    fn read_typing_rate(&mut self) -> Option<u16> {
        platform_typing_rate(self)
    }
}

#[cfg(target_os = "macos")]
fn platform_typing_rate(sampler: &mut TypingSampler) -> Option<u16> {
    const KCG_EVENT_SOURCE_STATE_COMBINED_SESSION_STATE: u32 = 0;
    const KCG_EVENT_KEY_DOWN: u32 = 10;

    #[link(name = "ApplicationServices", kind = "framework")]
    unsafe extern "C" {
        fn CGEventSourceCounterForEventType(state_id: u32, event_type: u32) -> u64;
    }

    let current_key_count = unsafe {
        CGEventSourceCounterForEventType(
            KCG_EVENT_SOURCE_STATE_COMBINED_SESSION_STATE,
            KCG_EVENT_KEY_DOWN,
        )
    };

    let previous_key_count = sampler.previous_key_count.replace(current_key_count)?;
    let key_delta = current_key_count.saturating_sub(previous_key_count);

    Some(per_minute_rate(key_delta))
}

#[cfg(target_os = "windows")]
fn platform_typing_rate(sampler: &mut TypingSampler) -> Option<u16> {
    use windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;

    let mut key_delta = 0_u16;

    for virtual_key in 0_u16..=255 {
        let key_state = unsafe { GetAsyncKeyState(virtual_key as i32) };
        let is_pressed = (key_state as u16 & 0x8000) != 0;
        let was_pressed = sampler.previous_pressed_keys[virtual_key as usize];

        if is_pressed && !was_pressed {
            key_delta = key_delta.saturating_add(1);
        }

        sampler.previous_pressed_keys[virtual_key as usize] = is_pressed;
    }

    Some(per_minute_rate(key_delta as u64))
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn platform_typing_rate(_sampler: &mut TypingSampler) -> Option<u16> {
    None
}

fn per_minute_rate(key_delta_per_second: u64) -> u16 {
    key_delta_per_second.saturating_mul(60).min(u16::MAX as u64) as u16
}
