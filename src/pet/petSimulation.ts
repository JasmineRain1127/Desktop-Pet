import type { PetMood } from "./petMood";

const petSensorMoodThresholds = {
  cpu: {
    focused: 35,
    stressed: 70,
    overheated: 90
  },
  typing: {
    focused: 120,
    stressed: 480,
    overheated: 900
  },
  idle: {
    sleepySeconds: 120,
    sleepingSeconds: 300
  }
} as const;

export const AUTOMATIC_MOOD_TRANSITION_DELAY_MS = 450;

export type PetSensorSnapshot = {
  cpuPercent: number;
  typingRate: number;
  idleSeconds: number;
};

export const initialSensorSnapshot: PetSensorSnapshot = {
  cpuPercent: 18,
  typingRate: 0,
  idleSeconds: 18
};

export function deriveMoodFromSensors(snapshot: PetSensorSnapshot): PetMood {
  if (snapshot.idleSeconds >= petSensorMoodThresholds.idle.sleepingSeconds) {
    return "sleeping";
  }

  if (snapshot.idleSeconds >= petSensorMoodThresholds.idle.sleepySeconds) {
    return "sleepy";
  }

  if (
    snapshot.cpuPercent >= petSensorMoodThresholds.cpu.overheated ||
    snapshot.typingRate >= petSensorMoodThresholds.typing.overheated
  ) {
    return "overheated";
  }

  if (
    snapshot.cpuPercent >= petSensorMoodThresholds.cpu.stressed ||
    snapshot.typingRate >= petSensorMoodThresholds.typing.stressed
  ) {
    return "stressed";
  }

  if (
    snapshot.cpuPercent >= petSensorMoodThresholds.cpu.focused ||
    snapshot.typingRate >= petSensorMoodThresholds.typing.focused
  ) {
    return "focused";
  }

  return "idle";
}

export function shouldDelayAutomaticMoodChange(
  currentMood: PetMood,
  nextMood: PetMood
) {
  if (currentMood === nextMood) {
    return false;
  }

  if (nextMood === "overheated" || nextMood === "sleeping") {
    return false;
  }

  if (currentMood === "sleepy" || currentMood === "sleeping") {
    return false;
  }

  return true;
}

export function formatIdleSeconds(seconds: number) {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}
