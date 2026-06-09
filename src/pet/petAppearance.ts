export type PetAppearanceId = "monster" | "cat" | "dog";

export type PetAppearanceConfig = {
  id: PetAppearanceId;
  label: string;
  shellClassName: string;
  windowLabel: string;
  dragLabel: string;
};

export const DEFAULT_PET_APPEARANCE_ID: PetAppearanceId = "monster";

export const petAppearanceConfigs: Record<PetAppearanceId, PetAppearanceConfig> = {
  monster: {
    id: "monster",
    label: "小怪兽",
    shellClassName: "is-appearance-monster",
    windowLabel: "桌面小怪兽",
    dragLabel: "拖动小怪兽"
  },
  cat: {
    id: "cat",
    label: "小猫",
    shellClassName: "is-appearance-cat",
    windowLabel: "桌面小猫",
    dragLabel: "拖动小猫"
  },
  dog: {
    id: "dog",
    label: "小狗",
    shellClassName: "is-appearance-dog",
    windowLabel: "桌面小狗",
    dragLabel: "拖动小狗"
  }
};

export const petAppearanceOrder: PetAppearanceId[] = ["monster", "cat", "dog"];
