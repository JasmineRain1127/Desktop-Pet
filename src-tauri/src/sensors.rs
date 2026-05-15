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
                idle_seconds: mock_snapshot.idle_seconds,
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
