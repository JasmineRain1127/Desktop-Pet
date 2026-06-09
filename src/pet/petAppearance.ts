export type PetAppearanceId = "monster";

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
  }
};

export const petAppearanceOrder: PetAppearanceId[] = ["monster"];
