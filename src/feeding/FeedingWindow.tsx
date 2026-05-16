import { emit } from "@tauri-apps/api/event";
import { useRef, useState, type DragEvent } from "react";
import {
  classifyFeedingFile,
  FEEDING_RESULT_EVENT,
  formatFileSize,
  type FeedingResult
} from "./petFeeding";

export function FeedingWindow() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastResult, setLastResult] = useState<FeedingResult | null>(null);

  async function feedFile(file: File) {
    const result = classifyFeedingFile(file);

    setLastResult(result);

    try {
      await emit(FEEDING_RESULT_EVENT, result);
    } catch (error: unknown) {
      console.warn("Unable to emit feeding result.", error);
    }
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);

    const [file] = Array.from(event.dataTransfer.files);

    if (file) {
      void feedFile(file);
    }
  }

  return (
    <main className="feeding-shell" aria-label="投喂小怪兽">
      <section className="feeding-bowl" aria-label="投喂碗">
        <button
          className="feeding-dropzone"
          data-dragging={isDragging}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          type="button"
        >
          <span className="feeding-mouth">༼つ ◕_◕ ༽つ</span>
          <span className="feeding-prompt">把文件放进碗里</span>
        </button>
        <input
          className="feeding-file-input"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";

            if (file) {
              void feedFile(file);
            }
          }}
          ref={inputRef}
          type="file"
        />
      </section>
      <section className="feeding-result" aria-live="polite">
        {lastResult ? (
          <>
            <div className="feeding-result-message">{lastResult.message}</div>
            <div className="feeding-file-name">{lastResult.fileName}</div>
            <div className="feeding-file-meta">
              {lastResult.extension || "无扩展名"} ·{" "}
              {formatFileSize(lastResult.sizeBytes)}
            </div>
          </>
        ) : (
          <>
            <div className="feeding-result-message">小碗空着</div>
            <div className="feeding-file-meta">只读取文件名、类型和大小</div>
          </>
        )}
      </section>
    </main>
  );
}
