import { describe, expect, it } from "vitest";

import {
  getNextPetAppearanceId,
  isPetAppearanceId
} from "./petAppearance";

describe("pet appearance", () => {
  it("cycles through every appearance", () => {
    expect(getNextPetAppearanceId("monster")).toBe("cat");
    expect(getNextPetAppearanceId("cat")).toBe("dog");
    expect(getNextPetAppearanceId("dog")).toBe("monster");
  });

  it("validates persisted identifiers", () => {
    expect(isPetAppearanceId("monster")).toBe(true);
    expect(isPetAppearanceId("dragon")).toBe(false);
  });
});
