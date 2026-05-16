import type { PetMood } from "./petMood";

const CPU_FOCUSED_THRESHOLD = 35;
const CPU_STRESSED_THRESHOLD = 70;
const CPU_OVERHEATED_THRESHOLD = 90;
const TYPING_FOCUSED_THRESHOLD = 120;
const TYPING_STRESSED_THRESHOLD = 480;
const TYPING_OVERHEATED_THRESHOLD = 900;

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
  if (snapshot.idleSeconds >= 300) {
    return "sleeping";
  }

  if (snapshot.idleSeconds >= 120) {
    return "sleepy";
  }

  if (
    snapshot.cpuPercent >= CPU_OVERHEATED_THRESHOLD ||
    snapshot.typingRate >= TYPING_OVERHEATED_THRESHOLD
  ) {
    return "overheated";
  }

  if (
    snapshot.cpuPercent >= CPU_STRESSED_THRESHOLD ||
    snapshot.typingRate >= TYPING_STRESSED_THRESHOLD
  ) {
    return "stressed";
  }

  if (
    snapshot.cpuPercent >= CPU_FOCUSED_THRESHOLD ||
    snapshot.typingRate >= TYPING_FOCUSED_THRESHOLD
  ) {
    return "focused";
  }

  return "idle";
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
