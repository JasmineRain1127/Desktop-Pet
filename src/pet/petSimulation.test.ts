import { describe, expect, it } from "vitest";

import {
  OVERHEATED_SUSTAIN_DURATION_MS,
  advanceAutomaticMoodState,
  deriveMoodFromSensors,
  formatIdleSeconds,
  initialAutomaticMoodState,
  shouldDelayAutomaticMoodChange
} from "./petSimulation";

describe("deriveMoodFromSensors", () => {
  it("uses sleep as the highest-priority signal", () => {
    expect(
      deriveMoodFromSensors({
        cpuPercent: 100,
        typingRate: 1200,
        idleSeconds: 300
      })
    ).toBe("sleeping");
  });

  it("handles null sensors and exact thresholds", () => {
    expect(
      deriveMoodFromSensors({
        cpuPercent: null,
        typingRate: null,
        idleSeconds: null
      })
    ).toBe("idle");
    expect(
      deriveMoodFromSensors({
        cpuPercent: 35,
        typingRate: null,
        idleSeconds: null
      })
    ).toBe("focused");
    expect(
      deriveMoodFromSensors({
        cpuPercent: null,
        typingRate: 480,
        idleSeconds: null
      })
    ).toBe("stressed");
  });

  it("can suppress overheated for sustained-signal evaluation", () => {
    expect(
      deriveMoodFromSensors(
        { cpuPercent: null, typingRate: 900, idleSeconds: null },
        false
      )
    ).toBe("stressed");
  });
});

describe("advanceAutomaticMoodState", () => {
  const hotSnapshot = {
    cpuPercent: 95,
    typingRate: null,
    idleSeconds: null
  };

  it("requires a continuous ten-second overheat signal", () => {
    const started = advanceAutomaticMoodState(
      initialAutomaticMoodState,
      hotSnapshot,
      1_000
    );
    const almost = advanceAutomaticMoodState(
      started,
      hotSnapshot,
      1_000 + OVERHEATED_SUSTAIN_DURATION_MS - 1
    );
    const sustained = advanceAutomaticMoodState(
      almost,
      hotSnapshot,
      1_000 + OVERHEATED_SUSTAIN_DURATION_MS
    );

    expect(started).toEqual({ mood: "stressed", overheatStartedAtMs: 1_000 });
    expect(almost.mood).toBe("stressed");
    expect(sustained.mood).toBe("overheated");
  });

  it("resets the timer when the overheat signal drops", () => {
    const started = advanceAutomaticMoodState(
      initialAutomaticMoodState,
      hotSnapshot,
      1_000
    );
    const cooled = advanceAutomaticMoodState(
      started,
      { cpuPercent: 50, typingRate: null, idleSeconds: null },
      5_000
    );
    const hotAgain = advanceAutomaticMoodState(cooled, hotSnapshot, 9_000);

    expect(cooled).toEqual({ mood: "focused", overheatStartedAtMs: null });
    expect(hotAgain).toEqual({ mood: "stressed", overheatStartedAtMs: 9_000 });
  });

  it("resets the timer when idle sleep takes priority", () => {
    const state = advanceAutomaticMoodState(
      { mood: "stressed", overheatStartedAtMs: 1_000 },
      { ...hotSnapshot, idleSeconds: 120 },
      11_000
    );

    expect(state).toEqual({ mood: "sleepy", overheatStartedAtMs: null });
  });
});

describe("mood transition helpers", () => {
  it("keeps critical transitions immediate", () => {
    expect(shouldDelayAutomaticMoodChange("stressed", "overheated")).toBe(false);
    expect(shouldDelayAutomaticMoodChange("focused", "sleeping")).toBe(false);
    expect(shouldDelayAutomaticMoodChange("sleeping", "idle")).toBe(false);
    expect(shouldDelayAutomaticMoodChange("idle", "focused")).toBe(true);
  });

  it("formats idle duration", () => {
    expect(formatIdleSeconds(45)).toBe("45s");
    expect(formatIdleSeconds(120)).toBe("2m");
    expect(formatIdleSeconds(125)).toBe("2m 5s");
  });
});
