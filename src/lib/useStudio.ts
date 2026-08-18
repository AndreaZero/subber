import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import {
  attachListing,
  DEFAULT_OUTPUT_LANG,
  DEFAULT_SPOKEN_LANG,
  mergeVideos,
  overallProgress,
  samePath,
  type EngineStatus,
  type ExportProgress,
  type ExtractProgress,
  type LangCode,
  type ListedVideo,
  type QualityPreset,
  type ScriptFile,
  type ScriptSegment,
  type TranscribeProgress,
  type TranslateProgress,
} from "./files";
import {
  engineStatus,
  exportOutput,
  exportSource,
  extractAudio,
  inspectVideos,
  pickOutputDir,
  pickVideoFiles,
  previewVideos,
  readScript,
  saveScript,
  transcribeAudio,
  translateSegments,
} from "./native";
import { loadActiveGlossary, parseTerms, saveActiveGlossary, serializeTerms } from "./glossary";
import { loadHistory, pushHistory, type HistoryEntry } from "./history";
import {
  completedCount,
  failedCount,
  processedMediaSecs,
  qualityInfo,
  workspaceMode,
  type NavId,
  type RunPhase,
} from "./pipeline";
import { createToast, type ToastItem } from "./toasts";
import { loadUiLang, saveUiLang, t, type Msg, type UiLang } from "./i18n";

const SIDEBAR_KEY = "video-sub.sidebar.open";

export function useStudio() {
  const [videos, setVideos] = useState<ListedVideo[]>([]);
  const [dragging, setDragging] = useState(false);
  const [spokenLang, setSpokenLang] = useState<LangCode>(DEFAULT_SPOKEN_LANG);
  const [outputLang, setOutputLang] = useState<LangCode>(DEFAULT_OUTPUT_LANG);
  const [quality, setQuality] = useState<QualityPreset>("balanced");
  const [glossary, setGlossary] = useState(loadActiveGlossary);
  const [outputDir, setOutputDir] = useState("");
  const [adding, setAdding] = useState(false);
  const [working, setWorking] = useState(false);
  const [phase, setPhase] = useState<RunPhase>(null);
  const [nav, setNav] = useState<NavId>("home");
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem(SIDEBAR_KEY) !== "0");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [logs, setLogs] = useState<string[]>([]);
  const [commandOpen, setCommandOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [pendingQuality, setPendingQuality] = useState<QualityPreset | null>(null);
  const [removePath, setRemovePath] = useState<string | null>(null);
  const [clearHistoryOpen, setClearHistoryOpen] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [uiLang, setUiLangState] = useState<UiLang>(loadUiLang);
  const [script, setScript] = useState<ScriptFile | null>(null);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptSaving, setScriptSaving] = useState(false);
  const [engine, setEngine] = useState<EngineStatus | null>(null);

  const workingRef = useRef(false);
  const cancelRef = useRef(false);
  workingRef.current = working;

  const locked = adding || working;
  const terms = useMemo(() => parseTerms(glossary), [glossary]);
  const progress = overallProgress(videos);
  const mode = workspaceMode(videos, working);
  const selected = videos.find((video) => video.path === selectedPath) ?? null;
  const scriptPath = selected?.bundlePath || selected?.trlPath || selected?.jsonPath || null;

  const tr = useCallback(
    (key: Msg, vars?: Record<string, string | number>) => t(uiLang, key, vars),
    [uiLang],
  );

  const setUiLang = useCallback((next: UiLang) => {
    setUiLangState(next);
    saveUiLang(next);
  }, []);

  const toast = useCallback((tone: ToastItem["tone"], title: string, detail?: string) => {
    const item = createToast(tone, title, detail);
    setToasts((current) => [...current, item]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((entry) => entry.id !== item.id));
    }, 3400);
  }, []);

  const log = useCallback((line: string) => {
    setLogs((current) => [...current.slice(-180), `${new Date().toLocaleTimeString()}  ${line}`]);
  }, []);

  const copyText = useCallback(
    async (text: string, title: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast("success", title);
      } catch {
        toast("error", tr("toastCopyFail"), text);
      }
    },
    [toast, tr],
  );

  const addPaths = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0 || workingRef.current) {
        return;
      }
      setAdding(true);
      try {
        const result = await inspectVideos(paths);
        setVideos((current) => attachListing(mergeVideos(current, result.videos), current));
        setOutputDir((current) => current || result.videos[0]?.parentDir || "");
        setNav("home");
        if (result.videos[0]) {
          setSelectedPath(result.videos[0].path);
        }
        const incoming = result.videos.map((video) => video.path);
        if (incoming.length > 0) {
          void previewVideos(incoming)
            .then((previews) => {
              setVideos((current) =>
                current.map((video) => {
                  const item = previews.find((entry) => samePath(entry.videoPath, video.path));
                  if (!item) {
                    return video;
                  }
                  return {
                    ...video,
                    frames: item.frames.length > 0 ? item.frames : video.frames,
                    durationSecs: item.durationSecs ?? video.durationSecs,
                  };
                }),
              );
            })
            .catch(() => undefined);
        }
        if (result.skipped.length > 0) {
          toast(
            "warning",
            result.skipped.length === 1
              ? tr("toastSkippedOne")
              : tr("toastSkippedMany", { n: result.skipped.length }),
            result.skipped[0]?.reason,
          );
        } else if (result.videos.length === 1) {
          toast("success", tr("toastAddedOne"), result.videos[0].name);
        } else if (result.videos.length > 1) {
          toast("success", tr("toastAddedMany", { n: result.videos.length }));
        }
      } catch (error) {
        toast("error", tr("toastAddFail"), error instanceof Error ? error.message : String(error));
      } finally {
        setAdding(false);
      }
    },
    [toast, tr],
  );

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, sidebarOpen ? "1" : "0");
  }, [sidebarOpen]);

  useEffect(() => {
    saveActiveGlossary(glossary);
  }, [glossary]);

  useEffect(() => {
    void engineStatus()
      .then(setEngine)
      .catch(() => setEngine(null));
  }, []);

  useEffect(() => {
    if (!scriptPath) {
      setScript(null);
      setScriptLoading(false);
      return;
    }
    let cancelled = false;
    setScriptLoading(true);
    readScript(scriptPath)
      .then((data) => {
        if (!cancelled) {
          setScript(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setScript(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setScriptLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [scriptPath]);

  useEffect(() => {
    const prevent = (event: DragEvent) => {
      event.preventDefault();
    };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);

    let disposed = false;
    let unlisten: (() => void) | undefined;

    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") {
          setDragging(true);
        } else if (event.payload.type === "leave") {
          setDragging(false);
        } else if (event.payload.type === "drop") {
          setDragging(false);
          void addPaths(event.payload.paths);
        }
      })
      .then((fn) => {
        if (disposed) {
          fn();
        } else {
          unlisten = fn;
        }
      })
      .catch((error: unknown) => {
        toast("error", tr("toastDropFail"), error instanceof Error ? error.message : String(error));
      });

    return () => {
      disposed = true;
      unlisten?.();
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, [addPaths, toast]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    listen<ExtractProgress>("extract-progress", (event) => {
      const payload = event.payload;
      log(`${payload.status}: ${payload.message}`);
      setVideos((current) =>
        current.map((video) => {
          if (!samePath(video.path, payload.videoPath)) {
            return video;
          }
          if (payload.status === "extracting") {
            return {
              ...video,
              status: "extracting",
              percent: payload.percent ?? video.percent,
              audioPath: payload.audioPath ?? video.audioPath,
              message: payload.message,
              error: undefined,
            };
          }
          if (payload.status === "done") {
            return {
              ...video,
              status: "audio_ready",
              percent: 100,
              audioPath: payload.audioPath ?? video.audioPath,
              message: payload.message,
              error: undefined,
            };
          }
          return {
            ...video,
            status: "error",
            error: payload.message,
            message: payload.message,
            percent: undefined,
          };
        }),
      );
    }).then((fn) => {
      if (disposed) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [log]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    listen<TranscribeProgress>("transcribe-progress", (event) => {
      const payload = event.payload;
      log(`${payload.status}: ${payload.message}`);
      setVideos((current) =>
        current.map((video) => {
          if (!samePath(video.path, payload.videoPath)) {
            return video;
          }
          if (payload.status === "transcribing") {
            return {
              ...video,
              status: "transcribing",
              percent: payload.percent ?? video.percent,
              jsonPath: payload.jsonPath ?? video.jsonPath,
              segmentCount: payload.segmentCount ?? video.segmentCount,
              message: payload.message,
              error: undefined,
            };
          }
          if (payload.status === "done") {
            return {
              ...video,
              status: "transcribed",
              percent: 100,
              jsonPath: payload.jsonPath ?? video.jsonPath,
              segmentCount: payload.segmentCount ?? video.segmentCount,
              message: payload.message,
              error: undefined,
            };
          }
          return {
            ...video,
            status: "error",
            error: payload.message,
            message: payload.message,
            percent: undefined,
          };
        }),
      );
    }).then((fn) => {
      if (disposed) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [log]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    listen<ExportProgress>("export-progress", (event) => {
      const payload = event.payload;
      log(`${payload.status}: ${payload.message}`);
      setVideos((current) =>
        current.map((video) => {
          if (!samePath(video.path, payload.videoPath)) {
            return video;
          }
          if (payload.status === "exporting") {
            return {
              ...video,
              status: "exporting",
              percent: payload.percent ?? video.percent,
              message: payload.message,
              error: undefined,
            };
          }
          if (payload.status === "done") {
            toast("success", tr("toastSrt"), payload.srtPath?.split(/[/\\]/).pop());
            return {
              ...video,
              status: "exported",
              percent: 100,
              folderPath: payload.folderPath ?? video.folderPath,
              txtPath: payload.txtPath ?? video.txtPath,
              srtPath: payload.srtPath ?? video.srtPath,
              spokenCode: payload.language ?? video.spokenCode,
              message: payload.message,
              error: undefined,
            };
          }
          return {
            ...video,
            status: "error",
            error: payload.message,
            message: payload.message,
            percent: undefined,
          };
        }),
      );
    }).then((fn) => {
      if (disposed) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [log, toast, tr]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    listen<TranslateProgress>("translate-progress", (event) => {
      const payload = event.payload;
      log(`${payload.status}: ${payload.message}`);
      setVideos((current) =>
        current.map((video) => {
          if (!samePath(video.path, payload.videoPath)) {
            return video;
          }
          if (payload.status === "translating") {
            return {
              ...video,
              status: "translating",
              percent: payload.percent ?? video.percent,
              trlPath: payload.trlPath ?? video.trlPath,
              message: payload.message,
              error: undefined,
            };
          }
          if (payload.status === "done") {
            return {
              ...video,
              status: "translating",
              percent: 100,
              trlPath: payload.trlPath ?? video.trlPath,
              spokenCode: payload.sourceLanguage ?? video.spokenCode,
              outputCode: payload.targetLanguage ?? video.outputCode,
              message: payload.message,
              error: undefined,
            };
          }
          return {
            ...video,
            status: "error",
            error: payload.message,
            message: payload.message,
            percent: undefined,
          };
        }),
      );
    }).then((fn) => {
      if (disposed) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [log]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    listen<ExportProgress>("export-output-progress", (event) => {
      const payload = event.payload;
      log(`${payload.status}: ${payload.message}`);
      setVideos((current) =>
        current.map((video) => {
          if (!samePath(video.path, payload.videoPath)) {
            return video;
          }
          if (payload.status === "exporting") {
            return {
              ...video,
              status: "translating",
              percent: payload.percent ?? video.percent,
              folderPath: payload.folderPath ?? video.folderPath,
              message: payload.message,
              error: undefined,
            };
          }
          if (payload.status === "done") {
            toast("success", tr("toastExportFolder"), payload.folderPath?.split(/[/\\]/).pop());
            return {
              ...video,
              status: "translated",
              percent: 100,
              folderPath: payload.folderPath ?? video.folderPath,
              outputSrtPath: payload.srtPath ?? video.outputSrtPath,
              bundlePath: payload.jsonPath ?? video.bundlePath,
              srtPath: payload.srtPath ?? video.srtPath,
              outputCode: payload.language ?? video.outputCode,
              message: payload.message,
              error: undefined,
            };
          }
          return {
            ...video,
            status: "error",
            error: payload.message,
            message: payload.message,
            percent: undefined,
          };
        }),
      );
    }).then((fn) => {
      if (disposed) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [log, toast, tr]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!working || startedAt == null) {
      return;
    }
    const tick = () => setElapsedSecs(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [working, startedAt]);

  async function onPickFiles() {
    try {
      const paths = await pickVideoFiles();
      await addPaths(paths);
    } catch (error) {
      toast("error", tr("toastOpenFail"), error instanceof Error ? error.message : String(error));
    }
  }

  async function onPickOutput() {
    try {
      const dir = await pickOutputDir();
      if (dir) {
        setOutputDir(dir);
        toast("info", tr("toastFolderSet"));
      }
    } catch (error) {
      toast("error", tr("toastFolderFail"), error instanceof Error ? error.message : String(error));
    }
  }

  function requestCancel() {
    cancelRef.current = true;
    toast("warning", tr("toastStopping"));
  }

  async function runPipeline(targetVideos?: ListedVideo[]) {
    const batch = targetVideos ?? videos;
    if (batch.length === 0) {
      toast("error", tr("toastNeedVideo"));
      return;
    }
    if (!outputDir.trim()) {
      toast("error", tr("toastNeedFolder"));
      setNav("settings");
      return;
    }

    try {
      const status = await engineStatus();
      setEngine(status);
      if (!status.ffmpegOk) {
        toast("error", tr("toastEngineFfmpeg"), status.ffmpegPath ?? undefined);
        return;
      }
      if (!status.whisperOk) {
        toast("error", tr("toastEngineWhisper"));
        return;
      }
    } catch (error) {
      toast("error", tr("toastStopped"), error instanceof Error ? error.message : String(error));
      return;
    }

    const paths = batch.map((video) => video.path);
    const folder = outputDir.trim();
    cancelRef.current = false;
    setWorking(true);
    setPhase("extract");
    setStartedAt(Date.now());
    setElapsedSecs(0);
    setNav("home");
    setVideos((current) =>
      current.map((video) =>
        paths.some((path) => samePath(path, video.path))
          ? {
              ...video,
              status: "queued",
              percent: 0,
              error: undefined,
              jsonPath: undefined,
              folderPath: undefined,
              segmentCount: undefined,
              txtPath: undefined,
              srtPath: undefined,
              outputSrtPath: undefined,
              bundlePath: undefined,
              trlPath: undefined,
              message: undefined,
            }
          : video,
      ),
    );

    try {
      const result = await extractAudio(paths, folder);
      setVideos((current) =>
        current.map((video) => {
          const item = result.items.find((entry) => samePath(entry.videoPath, video.path));
          if (!item) {
            return video;
          }
          if (item.error) {
            return { ...video, status: "error", error: item.error, percent: undefined };
          }
          return {
            ...video,
            status: "audio_ready",
            audioPath: item.audioPath ?? undefined,
            durationSecs: item.durationSecs ?? video.durationSecs,
            percent: 100,
            error: undefined,
          };
        }),
      );

      if (cancelRef.current) {
        toast("info", tr("toastStoppedAudio"));
        return;
      }

      const jobs = result.items.flatMap((item) =>
        item.audioPath && !item.error ? [{ videoPath: item.videoPath, audioPath: item.audioPath }] : [],
      );
      if (jobs.length === 0) {
        toast("error", tr("toastNoAudio"));
        return;
      }

      setPhase("transcribe");
      const transcript = await transcribeAudio(jobs, spokenLang, quality, glossary);
      setVideos((current) =>
        current.map((video) => {
          const item = transcript.items.find((entry) => samePath(entry.videoPath, video.path));
          if (!item) {
            return video;
          }
          if (item.error) {
            return { ...video, status: "error", error: item.error, percent: undefined };
          }
          return {
            ...video,
            status: "transcribed",
            jsonPath: item.jsonPath ?? undefined,
            segmentCount: item.segmentCount,
            percent: 100,
            error: undefined,
          };
        }),
      );

      if (cancelRef.current) {
        toast("info", tr("toastStoppedTranscribe"));
        return;
      }

      const exportJobs = transcript.items.flatMap((item) =>
        item.jsonPath && !item.error ? [{ videoPath: item.videoPath, jsonPath: item.jsonPath }] : [],
      );
      if (exportJobs.length === 0) {
        toast("error", tr("toastNoTranscript"));
        return;
      }

      setPhase("export");
      const exported = await exportSource(exportJobs);
      setVideos((current) =>
        current.map((video) => {
          const item = exported.items.find((entry) => samePath(entry.videoPath, video.path));
          if (!item) {
            return video;
          }
          if (item.error) {
            return { ...video, status: "error", error: item.error, percent: undefined };
          }
          return {
            ...video,
            status: "exported",
            folderPath: item.folderPath ?? undefined,
            txtPath: item.txtPath ?? undefined,
            srtPath: item.srtPath ?? undefined,
            spokenCode: item.language ?? undefined,
            percent: 100,
            error: undefined,
          };
        }),
      );

      if (cancelRef.current) {
        toast("info", tr("toastStoppedSubs"));
        return;
      }

      const translateJobs = transcript.items.flatMap((item) =>
        item.jsonPath && !item.error
          ? [
              {
                videoPath: item.videoPath,
                jsonPath: item.jsonPath,
                ...(spokenLang !== "auto" ? { sourceLanguage: spokenLang } : {}),
              },
            ]
          : [],
      );
      if (translateJobs.length === 0) {
        toast("error", tr("toastNothingTranslate"));
        return;
      }

      const translateReady = await engineStatus();
      setEngine(translateReady);
      if (!translateReady.translateOk && spokenLang !== outputLang) {
        toast("error", tr("toastEngineTranslate"));
        return;
      }

      setPhase("translate");
      const translated = await translateSegments(translateJobs, outputLang, glossary);
      setVideos((current) =>
        current.map((video) => {
          const item = translated.items.find((entry) => samePath(entry.videoPath, video.path));
          if (!item) {
            return video;
          }
          if (item.error) {
            return { ...video, status: "error", error: item.error, percent: undefined };
          }
          return {
            ...video,
            status: "translating",
            trlPath: item.trlPath ?? undefined,
            spokenCode: item.sourceLanguage ?? video.spokenCode,
            outputCode: item.targetLanguage ?? outputLang,
            percent: 100,
            error: undefined,
          };
        }),
      );

      if (cancelRef.current) {
        toast("info", tr("toastStoppedTranslate"));
        return;
      }

      const outputJobs = translated.items.flatMap((item) =>
        item.trlPath && !item.error ? [{ videoPath: item.videoPath, trlPath: item.trlPath }] : [],
      );
      if (outputJobs.length === 0) {
        toast("error", tr("toastNoTranslateFiles"));
        return;
      }

      setPhase("export");
      const packed = await exportOutput(outputJobs);
      setVideos((current) =>
        current.map((video) => {
          const item = packed.items.find((entry) => samePath(entry.videoPath, video.path));
          if (!item) {
            return video;
          }
          if (item.error) {
            return { ...video, status: "error", error: item.error, percent: undefined };
          }
          return {
            ...video,
            status: "translated",
            folderPath: item.folderPath ?? video.folderPath,
            outputSrtPath: item.srtPath ?? undefined,
            bundlePath: item.jsonPath ?? undefined,
            srtPath: item.srtPath ?? video.srtPath,
            outputCode: item.language ?? video.outputCode,
            percent: 100,
            error: undefined,
          };
        }),
      );
      for (const item of packed.items) {
        if (item.error) {
          continue;
        }
        const video = batch.find((entry) => samePath(entry.path, item.videoPath));
        if (video) {
          toast("success", tr("toastCompleted", { name: video.name }));
        }
      }

      const failed =
        result.items.filter((item) => item.error).length +
        transcript.items.filter((item) => item.error).length +
        exported.items.filter((item) => item.error).length +
        translated.items.filter((item) => item.error).length +
        packed.items.filter((item) => item.error).length;
      const ok = packed.items.filter((item) => !item.error).length;

      const snapshot: HistoryEntry[] = [];
      for (const item of packed.items) {
        const translatedItem = translated.items.find((entry) =>
          samePath(entry.videoPath, item.videoPath),
        );
        const video = batch.find((entry) => samePath(entry.path, item.videoPath));
        snapshot.push({
          id: `${item.videoPath}-${Date.now()}`,
          name: video?.name ?? item.videoPath,
          at: Date.now(),
          ok: !item.error,
          spoken: translatedItem?.sourceLanguage ?? undefined,
          output: item.language ?? translatedItem?.targetLanguage ?? undefined,
          detail: item.error ?? undefined,
        });
      }
      for (const item of translated.items) {
        if (!item.error) {
          continue;
        }
        const video = batch.find((entry) => samePath(entry.path, item.videoPath));
        snapshot.push({
          id: `${item.videoPath}-${Date.now()}`,
          name: video?.name ?? item.videoPath,
          at: Date.now(),
          ok: false,
          spoken: item.sourceLanguage ?? undefined,
          output: item.targetLanguage ?? undefined,
          detail: item.error ?? undefined,
        });
      }
      setHistory((current) => {
        let next = current;
        for (const entry of snapshot) {
          next = pushHistory(next, entry);
        }
        return next;
      });

      if (failed === 0) {
        if (ok > 1) {
          toast("success", tr("toastManyDone", { n: ok }));
        }
      } else {
        toast("warning", tr("toastWithErrors"), tr("toastOkCount", { n: ok }));
      }
    } catch (error) {
      toast("error", tr("toastStopped"), error instanceof Error ? error.message : String(error));
      log(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
      setPhase(null);
    }
  }

  function setTerms(next: string[]) {
    setGlossary(serializeTerms(next));
  }

  async function saveEdits(segments: ScriptSegment[]) {
    if (!selected || !scriptPath) {
      return;
    }
    setScriptSaving(true);
    try {
      const result = await saveScript(selected.path, scriptPath, segments);
      const item = result.items[0];
      if (item?.error) {
        toast("error", tr("toastSaveFail"), item.error);
        return;
      }
      setVideos((current) =>
        current.map((video) =>
          samePath(video.path, selected.path)
            ? {
                ...video,
                folderPath: item?.folderPath ?? video.folderPath,
                outputSrtPath: item?.srtPath ?? video.outputSrtPath,
                bundlePath: item?.jsonPath ?? video.bundlePath,
                srtPath: item?.srtPath ?? video.srtPath,
              }
            : video,
        ),
      );
      const fresh = await readScript(item?.jsonPath || scriptPath);
      setScript(fresh);
      toast("success", tr("toastSaved"));
    } catch (error) {
      toast("error", tr("toastSaveFail"), error instanceof Error ? error.message : String(error));
    } finally {
      setScriptSaving(false);
    }
  }

  return {
    videos,
    setVideos,
    dragging,
    spokenLang,
    setSpokenLang,
    outputLang,
    setOutputLang,
    quality,
    setQuality,
    glossary,
    setGlossary,
    terms,
    setTerms,
    outputDir,
    setOutputDir,
    adding,
    working,
    phase,
    locked,
    progress,
    mode,
    nav,
    setNav,
    sidebarOpen,
    setSidebarOpen,
    selectedPath,
    setSelectedPath,
    selected,
    script,
    scriptLoading,
    scriptSaving,
    engine,
    uiLang,
    setUiLang,
    tr,
    toasts,
    history,
    setHistory,
    logs,
    commandOpen,
    setCommandOpen,
    advancedOpen,
    setAdvancedOpen,
    elapsedSecs,
    pendingQuality,
    setPendingQuality,
    removePath,
    setRemovePath,
    clearHistoryOpen,
    setClearHistoryOpen,
    toast,
    copyText,
    addPaths,
    onPickFiles,
    onPickOutput,
    requestCancel,
    runPipeline,
    saveEdits,
    qualityMeta: qualityInfo(quality),
    doneCount: completedCount(videos),
    failCount: failedCount(videos),
    processedSecs: processedMediaSecs(videos),
  };
}
