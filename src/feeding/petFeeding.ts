import type { PetMood } from "../pet/petMood";

export const FEEDING_RESULT_EVENT = "feeding_result";

export type FeedingFlavor = "code" | "image" | "archive" | "large" | "unknown";

export type FeedingResult = {
  fileName: string;
  extension: string;
  sizeBytes: number;
  modifiedAt: number;
  flavor: FeedingFlavor;
  reactionMood: Extract<PetMood, "happy" | "sad">;
  message: string;
};

const largeFileThresholdBytes = 50 * 1024 * 1024;
const codeExtensions = new Set([
  "c",
  "cpp",
  "cs",
  "css",
  "go",
  "html",
  "java",
  "js",
  "json",
  "jsx",
  "md",
  "py",
  "rs",
  "swift",
  "toml",
  "ts",
  "tsx",
  "vue",
  "yaml",
  "yml"
]);
const imageExtensions = new Set(["gif", "jpeg", "jpg", "png", "svg", "webp"]);
const archiveExtensions = new Set(["7z", "dmg", "gz", "rar", "tar", "tgz", "zip"]);

export function classifyFallbackFile(file: File): FeedingResult {
  return classifyFeedingMetadata({
    fileName: file.name,
    extension: getFileExtension(file.name),
    sizeBytes: file.size,
    modifiedAt: file.lastModified
  });
}

export function classifyFeedingMetadata(metadata: {
  fileName: string;
  extension: string;
  sizeBytes: number;
  modifiedAt: number;
}): FeedingResult {
  if (metadata.sizeBytes >= largeFileThresholdBytes) {
    return buildResult(metadata, "large", "sad", "这口太大了");
  }

  if (archiveExtensions.has(metadata.extension)) {
    return buildResult(metadata, "archive", "sad", "压缩包有点硌牙");
  }

  if (codeExtensions.has(metadata.extension)) {
    return buildResult(metadata, "code", "happy", "代码味道不错");
  }

  if (imageExtensions.has(metadata.extension)) {
    return buildResult(metadata, "image", "happy", "图像脆脆的");
  }

  return buildResult(metadata, "unknown", "sad", "还没学会吃这个");
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function buildResult(
  metadata: {
    fileName: string;
    extension: string;
    sizeBytes: number;
    modifiedAt: number;
  },
  flavor: FeedingFlavor,
  reactionMood: Extract<PetMood, "happy" | "sad">,
  message: string
): FeedingResult {
  return {
    fileName: metadata.fileName,
    extension: metadata.extension,
    sizeBytes: metadata.sizeBytes,
    modifiedAt: metadata.modifiedAt,
    flavor,
    reactionMood,
    message
  };
}

function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex < 0 || dotIndex === fileName.length - 1) {
    return "";
  }

  return fileName.slice(dotIndex + 1).toLowerCase();
}
