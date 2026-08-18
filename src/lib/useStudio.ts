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
  type BurnProgress,
  type EngineStatus,
  type ExportProgress,
  type ExtractProgress,
  type LangCode,
  type ListedVideo,
  type PreparePart,
  type QualityPreset,
  type ScriptFile,
  type ScriptSegment,
  type TranscribeProgress,
  type TranslateProgress,
} from "./files";
import {
  asBurnFit,
  asBurnResolution,
  asProductMode,
  burnCanvas,
  captionLangTag,
  captionsToAss,
  DEFAULT_CAPTION_STYLE,
  parseCaptionStyle,
  type CaptionStyle,
  type ProductMode,
} from "./captions";
import {
  engineStatus,
  exportOutput,
  exportSource,
  extractAudio,
  importDavinci,
  inspectVideos,
  openPath,
  pickOutputDir,
  pickVideoFiles,
  prepareModels,
  previewVideos,
  probeVideo,
  readProject,
  readScript,
  saveScript,
  transcribeAudio,
  translateSegments,
  writeProject,
  burnVideo,
} from "./native";
import { loadActiveGlossary, parseTerms, saveActiveGlossary, serializeTerms } from "./glossary";
import { loadHistory, makeHistoryEntry, pushHistory, type HistoryEntry } from "./history";
import {
  completedCount,
  failedCount,
  processedMediaSecs,
  qualityInfo,
  wantsTranslation,
  workspaceMode,
  type NavId,
  type RunPhase,
} from "./pipeline";
import { createToast, type ToastItem } from "./toasts";
import { loadUiLang, saveUiLang, t, type Msg, type UiLang } from "./i18n";
import { applyCaptionFont } from "./media";
import {
  buildProjectFile,
  createProjectFile,
  folderName,
  loadRecents,
  recentFromFile,
  removeRecent,
  snapToListed,
  toStudioProject,
  upsertRecent,
  videoToSnap,
  type ProjectRecent,
  type StudioProject,
} from "./projects";

const SIDEBAR_KEY = "video-sub.sidebar.open";
const AUTO_MODELS_KEY = "video-sub.models.auto";

let prepareLock = false;

function parentDir(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, "");
  const idx = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return idx >= 0 ? trimmed.slice(0, idx) : trimmed;
}

export type PrepareState = {
  active: boolean;
  part: string;
  message: string;
  percent: number;
};

export function useStudio() {
  const [videos, setVideos] = useState<ListedVideo[]>([]);
  const [dragging, setDragging] = useState(false);
  const [spokenLang, setSpokenLang] = useState<LangCode>(DEFAULT_SPOKEN_LANG);
  const [outputLang, setOutputLang] = useState<LangCode>(DEFAULT_OUTPUT_LANG);
  const [quality, setQuality] = useState<QualityPreset>("balanced");
  const [productMode, setProductMode] = useState<ProductMode>("srt");
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE);
  const [glossary, setGlossary] = useState(loadActiveGlossary);
  const [outputDir, setOutputDir] = useState("");
  const [project, setProject] = useState<StudioProject | null>(null);
  const [recents, setRecents] = useState<ProjectRecent[]>(loadRecents);
  const [projectBusy, setProjectBusy] = useState(false);
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
  const [prepare, setPrepare] = useState<PrepareState | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  const workingRef = useRef(false);
  const cancelRef = useRef(false);
  const preparingRef = useRef(false);
  const autoTriedRef = useRef(false);
  const projectRef = useRef<StudioProject | null>(null);
  const videosRef = useRef(videos);
  const spokenLangRef = useRef(spokenLang);
  const outputLangRef = useRef(outputLang);
  const qualityRef = useRef(quality);
  const productModeRef = useRef(productMode);
  const captionStyleRef = useRef(captionStyle);
  workingRef.current = working;
  projectRef.current = project;
  videosRef.current = videos;
  spokenLangRef.current = spokenLang;
  outputLangRef.current = outputLang;
  qualityRef.current = quality;
  productModeRef.current = productMode;
  captionStyleRef.current = captionStyle;

  useEffect(() => {
    applyCaptionFont(captionStyle.fontFamily, captionStyle.fontFile);
  }, [captionStyle.fontFamily, captionStyle.fontFile]);

  const locked = adding || working;
  const needsTranslation = wantsTranslation(spokenLang, outputLang);
  const engineReady = Boolean(
    engine?.pythonOk &&
      engine?.whisperOk &&
      engine?.whisperReady &&
      (!needsTranslation || (engine.translateOk && engine.translateReady)),
  );
  const appReady = engineReady && !prepare?.active;
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

  const applyPreviews = useCallback(async (paths: string[]) => {
    if (paths.length === 0) {
      return;
    }
    try {
      const previews = await previewVideos(paths);
      setVideos((current) =>
        current.map((video) => {
          const item = previews.find((entry) => samePath(entry.videoPath, video.path));
          if (!item) {
            return video;
          }
          if (item.frames.length === 0 && item.durationSecs == null) {
            return video;
          }
          return {
            ...video,
            frames: item.frames.length > 0 ? item.frames : video.frames,
            durationSecs: item.durationSecs ?? video.durationSecs,
          };
        }),
      );
    } catch {
      /* ignore */
    }
  }, []);

  const persistCurrent = useCallback(async () => {
    const current = projectRef.current;
    if (!current) {
      return true;
    }
    const file = buildProjectFile(current, {
      spokenLang: spokenLangRef.current,
      outputLang: outputLangRef.current,
      quality: qualityRef.current,
      productMode: productModeRef.current,
      captionStyle: captionStyleRef.current,
      videos: videosRef.current,
    });
    try {
      await writeProject(file.folder, file);
      setRecents(upsertRecent(recentFromFile(file)));
      return true;
    } catch (error) {
      toast(
        "error",
        tr("projectSaveFail"),
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }, [toast, tr]);

  const enterProject = useCallback(
    async (file: ReturnType<typeof createProjectFile>, message: Msg) => {
      const studio = toStudioProject(file);
      projectRef.current = studio;
      setProject(studio);
      setOutputDir(file.folder);
      setSpokenLang(file.spokenLang);
      setOutputLang(file.outputLang);
      setQuality(file.quality);
      setProductMode(asProductMode(file.productMode));
      setCaptionStyle(parseCaptionStyle(file.captionStyle));
      setNav("home");
      setScript(null);
      setSelectedPath(null);
      setRecents(upsertRecent(recentFromFile(file)));

      const snaps = file.videos;
      if (snaps.length === 0) {
        setVideos([]);
        toast("success", tr(message), file.name);
        return;
      }

      try {
        const result = await inspectVideos(snaps.map((item) => item.path));
        const listed = attachListing(mergeVideos([], result.videos), snaps.map(snapToListed));
        setVideos(listed);
        if (listed[0]) {
          setSelectedPath(listed[0].path);
        }
        void applyPreviews(listed.map((video) => video.path));
        if (result.skipped.length > 0) {
          toast(
            "warning",
            result.skipped.length === 1
              ? tr("toastSkippedOne")
              : tr("toastSkippedMany", { n: result.skipped.length }),
            result.skipped[0]?.reason,
          );
        } else {
          toast("success", tr(message), file.name);
        }
      } catch (error) {
        setVideos(snaps.map(snapToListed));
        toast(
          "error",
          tr("projectOpenFail"),
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    [applyPreviews, toast, tr],
  );

  const createProject = useCallback(
    async (name: string, folder: string) => {
      setProjectBusy(true);
      try {
        const existing = await readProject(folder);
        if (existing) {
          await enterProject(existing, "projectOpenedExisting");
          return;
        }
        const file = createProjectFile({
          name,
          folder,
          spokenLang: spokenLangRef.current,
          outputLang: outputLangRef.current,
          quality: qualityRef.current,
        });
        await writeProject(folder, file);
        await enterProject(file, "projectCreated");
      } catch (error) {
        toast(
          "error",
          tr("projectCreateFail"),
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        setProjectBusy(false);
      }
    },
    [enterProject, toast, tr],
  );

  const openProjectFolder = useCallback(
    async (folder: string) => {
      setProjectBusy(true);
      try {
        const existing = await readProject(folder);
        if (existing) {
          await enterProject(existing, "projectOpened");
          return;
        }
        const file = createProjectFile({
          name: folderName(folder),
          folder,
          spokenLang: spokenLangRef.current,
          outputLang: outputLangRef.current,
          quality: qualityRef.current,
        });
        await writeProject(folder, file);
        await enterProject(file, "projectCreated");
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        if (/non trovata/i.test(detail)) {
          setRecents(removeRecent(folder));
          toast("error", tr("projectMissing"), detail);
        } else {
          toast("error", tr("projectOpenFail"), detail);
        }
      } finally {
        setProjectBusy(false);
      }
    },
    [enterProject, toast, tr],
  );

  const openRecentProject = useCallback(
    (folder: string) => {
      void openProjectFolder(folder);
    },
    [openProjectFolder],
  );

  const pickOpenProject = useCallback(async () => {
    try {
      const dir = await pickOutputDir(tr("projectPickFolder"));
      if (dir) {
        await openProjectFolder(dir);
      }
    } catch (error) {
      toast("error", tr("toastFolderFail"), error instanceof Error ? error.message : String(error));
    }
  }, [openProjectFolder, toast, tr]);

  const pickCreateFolder = useCallback(async () => {
    try {
      return await pickOutputDir(tr("projectPickFolder"));
    } catch (error) {
      toast("error", tr("toastFolderFail"), error instanceof Error ? error.message : String(error));
      return null;
    }
  }, [toast, tr]);

  const closeProject = useCallback(async () => {
    if (workingRef.current) {
      toast("warning", tr("projectBusyWork"));
      return;
    }
    const ok = await persistCurrent();
    if (!ok) {
      return;
    }
    projectRef.current = null;
    setProject(null);
    setOutputDir("");
    setVideos([]);
    setSelectedPath(null);
    setScript(null);
    setProductMode("srt");
    setCaptionStyle(DEFAULT_CAPTION_STYLE);
    setNav("home");
  }, [persistCurrent, toast, tr]);

  const renameProject = useCallback((name: string) => {
    setProject((current) => (current ? { ...current, name } : current));
  }, []);

  const setProjectFolder = useCallback((folder: string) => {
    setOutputDir(folder);
    setProject((current) => (current ? { ...current, folder } : current));
  }, []);

  const forgetRecent = useCallback((folder: string) => {
    setRecents(removeRecent(folder));
  }, []);

  const refreshEngine = useCallback(async () => {
    try {
      const status = await engineStatus(quality);
      setEngine(status);
      return status;
    } catch {
      setEngine(null);
      return null;
    }
  }, [quality]);

  const downloadModels = useCallback(
    async (parts: PreparePart = "all") => {
      if (preparingRef.current || workingRef.current || prepareLock) {
        return;
      }
      preparingRef.current = true;
      prepareLock = true;
      setBootError(null);
      localStorage.removeItem(AUTO_MODELS_KEY);
      setPrepare({
        active: true,
        part: parts === "translate" ? "translate" : "whisper",
        message: tr("setupDownloading"),
        percent: 0,
      });
      log("prepare: start");
      try {
        const result = await prepareModels(quality, parts);
        setPrepare({
          active: false,
          part: "engine",
          message: tr("setupReady"),
          percent: 100,
        });
        const status = await engineStatus(quality);
        setEngine(status);
        if (
          (parts === "whisper" && result.whisperReady) ||
          (parts === "translate" && result.translateReady) ||
          result.modelsReady ||
          (result.whisperReady && (!needsTranslation || result.translateReady)) ||
          (status.whisperReady && (!needsTranslation || status.translateReady))
        ) {
          toast("success", tr("toastModelsReady"));
        } else {
          setBootError(tr("toastModelsFail"));
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        setPrepare({
          active: false,
          part: "engine",
          message: detail,
          percent: 0,
        });
        setBootError(detail);
        toast("error", tr("toastModelsFail"), detail);
      } finally {
        preparingRef.current = false;
        prepareLock = false;
      }
    },
    [quality, toast, tr, log, needsTranslation],
  );

  const deferModels = useCallback(() => {
    localStorage.setItem(AUTO_MODELS_KEY, "0");
    autoTriedRef.current = true;
  }, []);

  const retrySetup = useCallback(() => {
    autoTriedRef.current = false;
    void downloadModels(needsTranslation ? "all" : "whisper");
  }, [downloadModels, needsTranslation]);

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

  const openFolder = useCallback(
    async (path?: string | null) => {
      if (!path) {
        toast("error", tr("folderOpenFail"));
        return;
      }
      try {
        await openPath(path);
        toast("success", tr("folderOpened"));
      } catch (error) {
        toast("error", tr("folderOpenFail"), error instanceof Error ? error.message : String(error));
      }
    },
    [toast, tr],
  );

  const importToDavinci = useCallback(
    async (video: ListedVideo) => {
      const srt = video.outputSrtPath || video.srtPath;
      if (!srt) {
        toast("error", tr("davinciFallback"));
        return;
      }
      toast("info", tr("davinciWorking"));
      try {
        const result = await importDavinci(srt, video.path);
        if (result.ok) {
          toast("success", tr("davinciImported"), result.message ?? undefined);
          return;
        }
        toast("warning", tr("davinciFallback"), result.message ?? undefined);
      } catch (error) {
        try {
          await openPath(srt);
        } catch {
          /* ignore */
        }
        toast(
          "warning",
          tr("davinciFallback"),
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    [toast, tr],
  );

  const addPaths = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0 || workingRef.current) {
        return;
      }
      if (!projectRef.current) {
        return;
      }
      setAdding(true);
      try {
        const result = await inspectVideos(paths);
        setVideos((current) => attachListing(mergeVideos(current, result.videos), current));
        setNav("home");
        if (result.videos[0]) {
          setSelectedPath(result.videos[0].path);
        }
        const incoming = result.videos.map((video) => video.path);
        if (incoming.length > 0) {
          void applyPreviews(incoming);
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
    [applyPreviews, toast, tr],
  );

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, sidebarOpen ? "1" : "0");
  }, [sidebarOpen]);

  const persistKey = useMemo(() => {
    if (!project) {
      return "";
    }
    return JSON.stringify({
      id: project.id,
      name: project.name,
      folder: project.folder,
      spokenLang,
      outputLang,
      quality,
      productMode,
      captionStyle,
      videos: videos.map(videoToSnap),
    });
  }, [project, spokenLang, outputLang, quality, productMode, captionStyle, videos]);

  useEffect(() => {
    if (!persistKey) {
      return;
    }
    const timer = window.setTimeout(() => {
      void persistCurrent();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [persistKey, persistCurrent]);

  useEffect(() => {
    saveActiveGlossary(glossary);
  }, [glossary]);

  useEffect(() => {
    autoTriedRef.current = false;
  }, [quality, needsTranslation]);

  useEffect(() => {
    void refreshEngine();
  }, [refreshEngine]);

  useEffect(() => {
    if (!engine) {
      return;
    }
    if (preparingRef.current || workingRef.current) {
      return;
    }
    const ready =
      engine.pythonOk &&
      engine.whisperOk &&
      engine.whisperReady &&
      (!needsTranslation || (engine.translateOk && engine.translateReady));
    if (ready) {
      return;
    }
    if (autoTriedRef.current) {
      return;
    }
    autoTriedRef.current = true;
    void downloadModels(needsTranslation ? "all" : "whisper");
  }, [engine, downloadModels, needsTranslation]);

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
      if (payload.status !== "extracting") {
        log(`${payload.status}: ${payload.message}`);
      }
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
      if (payload.status !== "transcribing") {
        log(`${payload.status}: ${payload.message}`);
      }
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
      if (payload.status !== "exporting") {
        log(`${payload.status}: ${payload.message}`);
      }
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
      if (payload.status !== "translating") {
        log(`${payload.status}: ${payload.message}`);
      }
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
      if (payload.status !== "exporting") {
        log(`${payload.status}: ${payload.message}`);
      }
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
    let disposed = false;
    let unlisten: (() => void) | undefined;

    listen<BurnProgress>("burn-progress", (event) => {
      const payload = event.payload;
      if (payload.status !== "burning") {
        log(`${payload.status}: ${payload.message}`);
      }
      setVideos((current) =>
        current.map((video) => {
          if (!samePath(video.path, payload.videoPath)) {
            return video;
          }
          if (payload.status === "burning") {
            return {
              ...video,
              status: "burning",
              percent: payload.percent ?? video.percent,
              message: payload.message,
              error: undefined,
            };
          }
          if (payload.status === "done") {
            return {
              ...video,
              status: "translated",
              percent: 100,
              burnedPath: payload.outputPath ?? video.burnedPath,
              message: payload.message,
              error: undefined,
            };
          }
          return {
            ...video,
            status:
              video.outputSrtPath || video.trlPath || video.srtPath ? "translated" : "error",
            error: payload.message,
            message: payload.message,
            percent: video.outputSrtPath || video.trlPath || video.srtPath ? 100 : undefined,
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
      const dir = await pickOutputDir(tr("projectPickFolder"));
      if (dir) {
        setProjectFolder(dir);
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

    const paths = batch.map((video) => video.path);
    const folder = outputDir.trim();
    const previous = new Map(
      batch.map((video) => [
        video.path.toLowerCase(),
        {
          status: video.status,
          percent: video.percent,
          message: video.message,
          error: video.error,
        },
      ]),
    );

    function abortStart() {
      setWorking(false);
      setPhase(null);
      setStartedAt(null);
      setVideos((current) =>
        current.map((video) => {
          const snap = previous.get(video.path.toLowerCase());
          return snap ? { ...video, ...snap } : video;
        }),
      );
    }

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
              status: "extracting",
              percent: Math.max(video.percent ?? 0, 3),
              message: tr("startingWork"),
              error: undefined,
            }
          : video,
      ),
    );

    try {
      const status = await engineStatus(quality);
      setEngine(status);
      if (!status.ffmpegOk) {
        abortStart();
        toast("error", tr("toastEngineFfmpeg"), status.ffmpegPath ?? undefined);
        return;
      }
      if (!status.whisperOk || !status.whisperReady) {
        abortStart();
        toast("error", tr("toastEngineWhisper"));
        if (!preparingRef.current) {
          void downloadModels("whisper");
        }
        return;
      }
      if (needsTranslation && (!status.translateOk || !status.translateReady)) {
        abortStart();
        toast("warning", tr("toastModelsFirst"));
        if (!preparingRef.current) {
          void downloadModels("all");
        }
        return;
      }
    } catch (error) {
      abortStart();
      toast("error", tr("toastStopped"), error instanceof Error ? error.message : String(error));
      return;
    }

    setVideos((current) =>
      current.map((video) =>
        paths.some((path) => samePath(path, video.path))
          ? {
              ...video,
              status: "extracting",
              percent: Math.max(video.percent ?? 0, 6),
              error: undefined,
              jsonPath: undefined,
              folderPath: undefined,
              segmentCount: undefined,
              txtPath: undefined,
              srtPath: undefined,
              outputSrtPath: undefined,
              bundlePath: undefined,
              trlPath: undefined,
              skipTranslation: undefined,
              spokenCode: undefined,
              outputCode: undefined,
              message: tr("jobExtracting"),
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

      const needFrames = result.items
        .filter((item) => !item.error)
        .map((item) => item.videoPath);
      void applyPreviews(needFrames);

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

      const exportedOk = exported.items.filter((item) => !item.error && item.srtPath);
      const skipItems = exportedOk.filter(
        (item) => !wantsTranslation(spokenLang, outputLang, item.language),
      );
      const translateJobs = exportedOk
        .filter((item) => wantsTranslation(spokenLang, outputLang, item.language))
        .flatMap((item) => {
          const json = transcript.items.find((entry) => samePath(entry.videoPath, item.videoPath));
          return json?.jsonPath && !json.error
            ? [
                {
                  videoPath: item.videoPath,
                  jsonPath: json.jsonPath,
                  ...(spokenLang !== "auto" ? { sourceLanguage: spokenLang } : {}),
                },
              ]
            : [];
        });

      if (skipItems.length > 0) {
        setVideos((current) =>
          current.map((video) => {
            const item = skipItems.find((entry) => samePath(entry.videoPath, video.path));
            if (!item) {
              return video;
            }
            return {
              ...video,
              status: "translated",
              skipTranslation: true,
              folderPath: item.folderPath ?? video.folderPath,
              txtPath: item.txtPath ?? video.txtPath,
              srtPath: item.srtPath ?? video.srtPath,
              outputSrtPath: item.srtPath ?? video.srtPath,
              bundlePath: video.jsonPath,
              spokenCode: item.language ?? video.spokenCode,
              outputCode: item.language ?? outputLang,
              percent: 100,
              error: undefined,
            };
          }),
        );
        for (const item of skipItems) {
          const video = batch.find((entry) => samePath(entry.path, item.videoPath));
          if (video) {
            toast("success", tr("toastCompleted", { name: video.name }));
          }
        }
      }

      if (translateJobs.length === 0) {
        const failed =
          result.items.filter((item) => item.error).length +
          transcript.items.filter((item) => item.error).length +
          exported.items.filter((item) => item.error).length;
        const ok = skipItems.length;
        const snapshot: HistoryEntry[] = skipItems.map((item) => {
          const video = batch.find((entry) => samePath(entry.path, item.videoPath));
          return makeHistoryEntry({
            path: item.videoPath,
            name: video?.name ?? item.videoPath,
            ok: true,
            spoken: item.language ?? undefined,
            output: item.language ?? outputLang,
            parentDir: video?.parentDir,
            project,
          });
        });
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
        return;
      }

      const translateReady = await engineStatus(quality);
      setEngine(translateReady);
      if (!translateReady.translateOk || !translateReady.translateReady) {
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
            skipTranslation: false,
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
            skipTranslation: false,
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
      const ok = packed.items.filter((item) => !item.error).length + skipItems.length;

      const snapshot: HistoryEntry[] = [];
      for (const item of skipItems) {
        const video = batch.find((entry) => samePath(entry.path, item.videoPath));
        snapshot.push(
          makeHistoryEntry({
            path: item.videoPath,
            name: video?.name ?? item.videoPath,
            ok: true,
            spoken: item.language ?? undefined,
            output: item.language ?? outputLang,
            parentDir: video?.parentDir,
            project,
          }),
        );
      }
      for (const item of packed.items) {
        const translatedItem = translated.items.find((entry) =>
          samePath(entry.videoPath, item.videoPath),
        );
        const video = batch.find((entry) => samePath(entry.path, item.videoPath));
        snapshot.push(
          makeHistoryEntry({
            path: item.videoPath,
            name: video?.name ?? item.videoPath,
            ok: !item.error,
            spoken: translatedItem?.sourceLanguage ?? undefined,
            output: item.language ?? translatedItem?.targetLanguage ?? undefined,
            detail: item.error ?? undefined,
            parentDir: video?.parentDir,
            project,
          }),
        );
      }
      for (const item of translated.items) {
        if (!item.error) {
          continue;
        }
        const video = batch.find((entry) => samePath(entry.path, item.videoPath));
        snapshot.push(
          makeHistoryEntry({
            path: item.videoPath,
            name: video?.name ?? item.videoPath,
            ok: false,
            spoken: item.sourceLanguage ?? undefined,
            output: item.targetLanguage ?? undefined,
            detail: item.error ?? undefined,
            parentDir: video?.parentDir,
            project,
          }),
        );
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

  async function runBurn(format: string, resolution: string, fit = "source") {
    if (workingRef.current) {
      return;
    }
    if (!outputDir.trim()) {
      toast("error", tr("toastNeedFolder"));
      setNav("settings");
      return;
    }
    const targets = selected
      ? [selected]
      : videos.filter((video) => video.bundlePath || video.trlPath || video.jsonPath);
    const ready = targets.filter((video) => video.bundlePath || video.trlPath || video.jsonPath);
    if (ready.length === 0) {
      toast("error", tr("toastBurnNeed"));
      return;
    }

    const previous = new Map(
      ready.map((video) => [
        video.path.toLowerCase(),
        { status: video.status, percent: video.percent, message: video.message, error: video.error },
      ]),
    );

    cancelRef.current = false;
    setWorking(true);
    setPhase("burn");
    setStartedAt(Date.now());
    setElapsedSecs(0);
    setVideos((current) =>
      current.map((video) =>
        ready.some((item) => samePath(item.path, video.path))
          ? { ...video, status: "burning", percent: 2, message: tr("phaseBurn"), error: undefined }
          : video,
      ),
    );

    try {
      const style = captionStyleRef.current;
      const fontDir = style.fontFile ? parentDir(style.fontFile) : null;
      const jobs = [];
      for (const video of ready) {
        if (cancelRef.current) {
          break;
        }
        const path = video.bundlePath || video.trlPath || video.jsonPath;
        if (!path) {
          continue;
        }
        const file =
          selected && samePath(selected.path, video.path) && script
            ? script
            : await readScript(path);
        if (file.segments.length === 0) {
          continue;
        }
        let width = 1920;
        let height = 1080;
        try {
          const size = await probeVideo(video.path);
          width = size.width;
          height = size.height;
        } catch (error) {
          toast("error", tr("toastBurnFail"), error instanceof Error ? error.message : String(error));
          continue;
        }
        const canvas = burnCanvas(width, height, asBurnResolution(resolution), asBurnFit(fit));
        jobs.push({
          videoPath: video.path,
          assText: captionsToAss(style, file.segments, canvas.width, canvas.height),
          language: captionLangTag(video.outputCode || file.targetLanguage || outputLangRef.current),
          folderPath: video.folderPath ?? null,
          fontDir,
        });
      }
      if (jobs.length === 0) {
        toast("error", tr("toastBurnNeed"));
        setVideos((current) =>
          current.map((video) => {
            const snap = previous.get(video.path.toLowerCase());
            return snap ? { ...video, ...snap } : video;
          }),
        );
        return;
      }
      const result = await burnVideo(jobs, format, resolution, outputDir.trim(), asBurnFit(fit));
      const failed = result.items.filter((item) => item.error);
      const ok = result.items.length - failed.length;
      if (failed.length === 0) {
        toast("success", ok === 1 ? tr("toastBurnDone") : tr("toastManyDone", { n: ok }));
        const first = result.items.find((item) => item.outputPath)?.outputPath;
        if (first) {
          void openFolder(first);
        }
      } else if (ok > 0) {
        toast("warning", tr("toastWithErrors"), failed[0]?.error);
      } else {
        toast("error", tr("toastBurnFail"), failed[0]?.error);
      }
    } catch (error) {
      toast("error", tr("toastBurnFail"), error instanceof Error ? error.message : String(error));
      log(error instanceof Error ? error.message : String(error));
      setVideos((current) =>
        current.map((video) => {
          const snap = previous.get(video.path.toLowerCase());
          return snap ? { ...video, ...snap } : video;
        }),
      );
    } finally {
      setWorking(false);
      setPhase(null);
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
    productMode,
    setProductMode,
    captionStyle,
    setCaptionStyle,
    glossary,
    setGlossary,
    terms,
    setTerms,
    outputDir,
    setOutputDir: setProjectFolder,
    project,
    recents,
    projectBusy,
    createProject,
    openRecentProject,
    pickOpenProject,
    pickCreateFolder,
    closeProject,
    renameProject,
    forgetRecent,
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
    prepare,
    bootError,
    appReady,
    needsTranslation,
    downloadModels,
    deferModels,
    retrySetup,
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
    openFolder,
    importToDavinci,
    addPaths,
    onPickFiles,
    onPickOutput,
    requestCancel,
    runPipeline,
    runBurn,
    saveEdits,
    qualityMeta: qualityInfo(quality),
    doneCount: completedCount(videos),
    failCount: failedCount(videos),
    processedSecs: processedMediaSecs(videos),
  };
}
