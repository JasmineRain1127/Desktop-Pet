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

export function classifyFeedingFile(file: File): FeedingResult {
  const extension = getFileExtension(file.name);

  if (file.size >= largeFileThresholdBytes) {
    return buildResult(file, extension, "large", "sad", "这口太大了");
  }

  if (archiveExtensions.has(extension)) {
    return buildResult(file, extension, "archive", "sad", "压缩包有点硌牙");
  }

  if (codeExtensions.has(extension)) {
    return buildResult(file, extension, "code", "happy", "代码味道不错");
  }

  if (imageExtensions.has(extension)) {
    return buildResult(file, extension, "image", "happy", "图像脆脆的");
  }

  return buildResult(file, extension, "unknown", "sad", "还没学会吃这个");
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
  file: File,
  extension: string,
  flavor: FeedingFlavor,
  reactionMood: Extract<PetMood, "happy" | "sad">,
  message: string
): FeedingResult {
  return {
    fileName: file.name,
    extension,
    sizeBytes: file.size,
    modifiedAt: file.lastModified,
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
