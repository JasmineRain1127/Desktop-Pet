export type PetMood =
  | "idle"
  | "focused"
  | "stressed"
  | "overheated"
  | "sleepy"
  | "sleeping"
  | "eating"
  | "happy"
  | "sad";

export type PetMoodConfig = {
  mood: PetMood;
  label: string;
  face: string;
  className: string;
  tone: "calm" | "work" | "pressure" | "rest" | "feeding";
  priority: number;
};

export const petMoodConfigs: Record<PetMood, PetMoodConfig> = {
  idle: {
    mood: "idle",
    label: "发呆中",
    face: "•ᴗ•",
    className: "is-idle",
    tone: "calm",
    priority: 10
  },
  focused: {
    mood: "focused",
    label: "陪你干活",
    face: "•̀ᴗ•́",
    className: "is-focused",
    tone: "work",
    priority: 20
  },
  stressed: {
    mood: "stressed",
    label: "有点紧张",
    face: "•́_•̀",
    className: "is-stressed",
    tone: "pressure",
    priority: 30
  },
  overheated: {
    mood: "overheated",
    label: "快过载了",
    face: "×_×",
    className: "is-overheated",
    tone: "pressure",
    priority: 40
  },
  sleepy: {
    mood: "sleepy",
    label: "开始犯困",
    face: "-.-",
    className: "is-sleepy",
    tone: "rest",
    priority: 15
  },
  sleeping: {
    mood: "sleeping",
    label: "睡着了",
    face: "u_u",
    className: "is-sleeping",
    tone: "rest",
    priority: 25
  },
  eating: {
    mood: "eating",
    label: "吞吞吞",
    face: "•༥•",
    className: "is-eating",
    tone: "feeding",
    priority: 50
  },
  happy: {
    mood: "happy",
    label: "好吃！",
    face: "ᵔᴗᵔ",
    className: "is-happy",
    tone: "feeding",
    priority: 45
  },
  sad: {
    mood: "sad",
    label: "噎住了",
    face: "ಥ_ಥ",
    className: "is-sad",
    tone: "feeding",
    priority: 45
  }
};

export const petMoodOrder: PetMood[] = [
  "idle",
  "focused",
  "stressed",
  "overheated",
  "sleepy",
  "sleeping",
  "eating",
  "happy",
  "sad"
];
