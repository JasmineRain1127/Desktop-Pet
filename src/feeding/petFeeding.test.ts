import { describe, expect, it } from "vitest";

import { classifyFeedingMetadata, formatFileSize } from "./petFeeding";

const metadata = (extension: string, sizeBytes = 100) => ({
  fileName: `sample.${extension}`,
  extension,
  sizeBytes,
  modifiedAt: 123
});

describe("classifyFeedingMetadata", () => {
  it.each([
    ["rs", "code", "happy"],
    ["png", "image", "happy"],
    ["zip", "archive", "sad"],
    ["txt", "unknown", "sad"]
  ] as const)("classifies .%s as %s", (extension, flavor, reactionMood) => {
    expect(classifyFeedingMetadata(metadata(extension))).toMatchObject({
      flavor,
      reactionMood
    });
  });

  it("prioritizes the large-file response", () => {
    expect(
      classifyFeedingMetadata(metadata("rs", 50 * 1024 * 1024))
    ).toMatchObject({ flavor: "large", reactionMood: "sad" });
  });
});

describe("formatFileSize", () => {
  it("formats bytes, kibibytes, and mebibytes", () => {
    expect(formatFileSize(900)).toBe("900 B");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});
