use std::{thread, time::Duration};

use serde::Serialize;
use sysinfo::System;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
struct SensorSnapshot {
    cpu_percent: Option<u8>,
    typing_rate: Option<u16>,
    idle_seconds: Option<u16>,
}

const SENSOR_EVENT: &str = "sensor_snapshot";

pub fn start_sensor_events(app: AppHandle) {
    thread::spawn(move || {
        let mut system = System::new();
        let mut typing_sampler = TypingSampler::new();

        system.refresh_cpu_usage();
        thread::sleep(Duration::from_secs(1));

        loop {
            let settings = crate::settings::current_settings(&app);
            let is_paused = settings.quiet_mode;

            if is_paused || !settings.typing_detection_enabled {
                typing_sampler.reset();
            }

            let snapshot = SensorSnapshot {
                cpu_percent: (!is_paused && settings.cpu_detection_enabled)
                    .then(|| read_cpu_percent(&mut system))
                    .flatten(),
                typing_rate: (!is_paused && settings.typing_detection_enabled)
                    .then(|| typing_sampler.read_typing_rate())
                    .flatten(),
                idle_seconds: (!is_paused && settings.idle_detection_enabled)
                    .then(read_idle_seconds)
                    .flatten(),
            };

            let _ = app.emit(SENSOR_EVENT, snapshot);

            thread::sleep(Duration::from_secs(1));
        }
    });
}

fn read_cpu_percent(system: &mut System) -> Option<u8> {
    system.refresh_cpu_usage();

    let usage = system.global_cpu_usage();

    if !usage.is_finite() {
        return None;
    }

    Some(usage.round().clamp(0.0, 100.0) as u8)
}

fn read_idle_seconds() -> Option<u16> {
    platform_idle_seconds()
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

#[cfg(target_os = "macos")]
fn finite_seconds_to_u16(seconds: f64) -> Option<u16> {
    if !seconds.is_finite() || seconds.is_sign_negative() {
        return None;
    }

    Some(seconds.round().clamp(0.0, u16::MAX as f64) as u16)
}

struct TypingSampler {
    #[cfg(target_os = "macos")]
    previous_key_count: Option<u64>,
}

impl TypingSampler {
    fn new() -> Self {
        Self {
            #[cfg(target_os = "macos")]
            previous_key_count: None,
        }
    }

    fn read_typing_rate(&mut self) -> Option<u16> {
        platform_typing_rate(self)
    }

    fn reset(&mut self) {
        #[cfg(target_os = "macos")]
        {
            self.previous_key_count = None;
        }
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
fn platform_typing_rate(_sampler: &mut TypingSampler) -> Option<u16> {
    use windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;

    let mut key_delta = 0_u16;

    for virtual_key in typing_virtual_keys() {
        let key_state = unsafe { GetAsyncKeyState(virtual_key as i32) };
        let was_pressed_since_last_sample = (key_state as u16 & 0x0001) != 0;

        if was_pressed_since_last_sample {
            key_delta = key_delta.saturating_add(1);
        }
    }

    Some(per_minute_rate(key_delta as u64))
}

#[cfg(target_os = "windows")]
fn typing_virtual_keys() -> impl Iterator<Item = u16> {
    const EDITING_KEYS: [u16; 5] = [0x08, 0x09, 0x0D, 0x1B, 0x20];
    const NUMBER_KEYS: std::ops::RangeInclusive<u16> = 0x30..=0x39;
    const LETTER_KEYS: std::ops::RangeInclusive<u16> = 0x41..=0x5A;
    const NUMPAD_KEYS: std::ops::RangeInclusive<u16> = 0x60..=0x6F;
    const PUNCTUATION_KEYS_1: std::ops::RangeInclusive<u16> = 0xBA..=0xC0;
    const PUNCTUATION_KEYS_2: std::ops::RangeInclusive<u16> = 0xDB..=0xDE;

    EDITING_KEYS
        .into_iter()
        .chain(NUMBER_KEYS)
        .chain(LETTER_KEYS)
        .chain(NUMPAD_KEYS)
        .chain(PUNCTUATION_KEYS_1)
        .chain(PUNCTUATION_KEYS_2)
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn platform_typing_rate(_sampler: &mut TypingSampler) -> Option<u16> {
    None
}

fn per_minute_rate(key_delta_per_second: u64) -> u16 {
    key_delta_per_second.saturating_mul(60).min(u16::MAX as u64) as u16
}
