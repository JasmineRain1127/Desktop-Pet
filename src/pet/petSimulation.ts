import type { PetMood } from "./petMood";

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

const simulationFrames: PetSensorSnapshot[] = [
  { cpuPercent: 18, typingRate: 0, idleSeconds: 18 },
  { cpuPercent: 42, typingRate: 34, idleSeconds: 0 },
  { cpuPercent: 64, typingRate: 58, idleSeconds: 0 },
  { cpuPercent: 76, typingRate: 94, idleSeconds: 0 },
  { cpuPercent: 92, typingRate: 146, idleSeconds: 0 },
  { cpuPercent: 31, typingRate: 8, idleSeconds: 135 },
  { cpuPercent: 14, typingRate: 0, idleSeconds: 320 },
  { cpuPercent: 26, typingRate: 12, idleSeconds: 45 }
];

export function getNextSensorSnapshot(frameIndex: number): PetSensorSnapshot {
  return simulationFrames[frameIndex % simulationFrames.length];
}

export function deriveMoodFromSensors(snapshot: PetSensorSnapshot): PetMood {
  if (snapshot.idleSeconds >= 300) {
    return "sleeping";
  }

  if (snapshot.idleSeconds >= 120) {
    return "sleepy";
  }

  if (snapshot.cpuPercent >= 90 || snapshot.typingRate >= 140) {
    return "overheated";
  }

  if (snapshot.cpuPercent >= 70 || snapshot.typingRate >= 90) {
    return "stressed";
  }

  if (snapshot.cpuPercent >= 35 || snapshot.typingRate >= 25) {
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
