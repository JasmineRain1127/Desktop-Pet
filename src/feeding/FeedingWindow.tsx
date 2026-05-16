import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef, useState } from "react";
import {
  classifyFallbackFile,
  FEEDING_RESULT_EVENT,
  formatFileSize,
  type FeedingResult
} from "./petFeeding";

const maxFeedingHistory = 3;

export function FeedingWindow() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastResult, setLastResult] = useState<FeedingResult | null>(null);
  const [history, setHistory] = useState<FeedingResult[]>([]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    getCurrentWindow()
      .onDragDropEvent((event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") {
          setIsDragging(true);
          return;
        }

        if (event.payload.type === "leave") {
          setIsDragging(false);
          return;
        }

        setIsDragging(false);
        const [path] = event.payload.paths;

        if (path) {
          void feedFilePath(path);
        }
      })
      .then((nextUnlisten) => {
        if (disposed) {
          nextUnlisten();
          return;
        }

        unlisten = nextUnlisten;
      })
      .catch((error: unknown) => {
        console.warn("Unable to listen for native file drops.", error);
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  async function publishResult(result: FeedingResult) {
    setErrorMessage("");
    setLastResult(result);
    setHistory((currentHistory) => [
      result,
      ...currentHistory.filter((item) => item.fileName !== result.fileName)
    ].slice(0, maxFeedingHistory));

    try {
      await emit(FEEDING_RESULT_EVENT, result);
    } catch (error: unknown) {
      console.warn("Unable to emit feeding result.", error);
    }
  }

  async function feedFilePath(path: string) {
    try {
      const result = await invoke<FeedingResult>("feed_file_path", { path });
      await publishResult(result);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function feedFallbackFile(file: File) {
    const result = classifyFallbackFile(file);

    try {
      await publishResult(result);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <main className="feeding-shell" aria-label="投喂小怪兽">
      <section className="feeding-bowl" aria-label="投喂碗">
        <button
          className="feeding-dropzone"
          data-dragging={isDragging}
          onClick={() => inputRef.current?.click()}
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
              void feedFallbackFile(file);
            }
          }}
          ref={inputRef}
          type="file"
        />
      </section>
      <section className="feeding-result" aria-live="polite">
        {errorMessage ? (
          <>
            <div className="feeding-result-message">投喂失败</div>
            <div className="feeding-file-meta">{errorMessage}</div>
          </>
        ) : lastResult ? (
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
      {history.length > 0 ? (
        <section className="feeding-history" aria-label="最近投喂记录">
          {history.map((item) => (
            <div className="feeding-history-item" key={`${item.fileName}-${item.modifiedAt}`}>
              <span>{item.fileName}</span>
              <strong>{item.message}</strong>
            </div>
          ))}
        </section>
      ) : null}
    </main>
  );
}
