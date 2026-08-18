export type VideoFile = {
  path: string;
  name: string;
  sizeBytes: number;
  parentDir: string;
};

export type SkippedFile = {
  path: string;
  reason: string;
};

export type InspectResult = {
  videos: VideoFile[];
  skipped: SkippedFile[];
};

export type QualityPreset = "fast" | "balanced" | "max";

export type { LangCode } from "./languages";
export {
  DEFAULT_OUTPUT_LANG,
  DEFAULT_SPOKEN_LANG,
  OUTPUT_LANGUAGES,
  SPOKEN_LANGUAGES,
  languageName,
} from "./languages";

export type VideoJobStatus =
  | "queued"
  | "extracting"
  | "audio_ready"
  | "transcribing"
  | "transcribed"
  | "exporting"
  | "exported"
  | "translating"
  | "translated"
  | "error";

export type ListedVideo = VideoFile & {
  status: VideoJobStatus;
  audioPath?: string;
  jsonPath?: string;
  folderPath?: string;
  txtPath?: string;
  srtPath?: string;
  outputSrtPath?: string;
  bundlePath?: string;
  trlPath?: string;
  spokenCode?: string;
  outputCode?: string;
  segmentCount?: number;
  durationSecs?: number;
  error?: string;
  percent?: number;
  message?: string;
  frames?: string[];
  addedAt: number;
};

export type ExtractProgress = {
  videoPath: string;
  audioPath: string | null;
  status: "extracting" | "done" | "error";
  message: string;
  percent: number | null;
};

export type TranscribeProgress = {
  videoPath: string;
  status: string;
  message: string;
  percent: number | null;
  jsonPath: string | null;
  segmentCount: number | null;
};

export type ExtractItem = {
  videoPath: string;
  audioPath: string | null;
  durationSecs: number | null;
  error: string | null;
};

export type ExtractBatchResult = {
  ffmpegPath: string;
  items: ExtractItem[];
};

export type TranscribeJob = {
  videoPath: string;
  audioPath: string;
};

export type TranscribeItem = {
  videoPath: string;
  jsonPath: string | null;
  segmentCount: number;
  error: string | null;
};

export type TranscribeBatchResult = {
  items: TranscribeItem[];
};

export type ExportProgress = {
  videoPath: string;
  status: string;
  message: string;
  percent: number | null;
  folderPath: string | null;
  txtPath: string | null;
  srtPath: string | null;
  jsonPath: string | null;
  language: string | null;
};

export type ExportJob = {
  videoPath: string;
  jsonPath: string;
};

export type ExportItem = {
  videoPath: string;
  folderPath: string | null;
  txtPath: string | null;
  srtPath: string | null;
  language: string | null;
  error: string | null;
};

export type ExportBatchResult = {
  items: ExportItem[];
};

export type OutputExportJob = {
  videoPath: string;
  trlPath: string;
};

export type OutputExportItem = {
  videoPath: string;
  folderPath: string | null;
  srtPath: string | null;
  jsonPath: string | null;
  language: string | null;
  error: string | null;
};

export type OutputExportBatchResult = {
  items: OutputExportItem[];
};

export type TranslateProgress = {
  videoPath: string;
  status: string;
  message: string;
  percent: number | null;
  trlPath: string | null;
  sourceLanguage: string | null;
  targetLanguage: string | null;
  segmentCount: number | null;
};

export type TranslateJob = {
  videoPath: string;
  jsonPath: string;
  sourceLanguage?: string;
};

export type TranslateItem = {
  videoPath: string;
  trlPath: string | null;
  sourceLanguage: string | null;
  targetLanguage: string | null;
  segmentCount: number;
  error: string | null;
};

export type TranslateBatchResult = {
  items: TranslateItem[];
};

export type ScriptSegment = {
  start: number;
  end: number;
  text: string;
  translated?: string | null;
  speaker?: string | null;
  confidence?: number | null;
};

export type ScriptFile = {
  sourceLanguage?: string | null;
  targetLanguage?: string | null;
  segments: ScriptSegment[];
};

export type VideoPreview = {
  videoPath: string;
  frames: string[];
  durationSecs: number | null;
};

export type EngineStatus = {
  ffmpegOk: boolean;
  ffmpegPath: string | null;
  pythonOk: boolean;
  pythonPath: string | null;
  whisperOk: boolean;
  translateOk: boolean;
  whisperReady: boolean;
  translateReady: boolean;
  modelsReady: boolean;
  whisperModel: string | null;
};

export type PreparePart = "all" | "whisper" | "translate";

export type PrepareProgress = {
  status: string;
  part: string;
  message: string;
  percent: number | null;
};

export type PrepareResult = {
  whisperReady: boolean;
  translateReady: boolean;
  modelsReady: boolean;
  whisperModel: string | null;
};

export type SaveScriptItem = {
  videoPath: string;
  path: string | null;
  folderPath: string | null;
  srtPath: string | null;
  jsonPath: string | null;
  error: string | null;
};

export type SaveScriptResult = {
  items: SaveScriptItem[];
};

export const DEFAULT_GLOSSARY = [
  "Caravaggio",
  "Michelangelo Merisi",
  "Cappella Contarelli",
  "San Luigi dei Francesi",
  "Otoniell",
].join("\n");

export function mergeVideos(
  current: VideoFile[],
  incoming: VideoFile[],
): VideoFile[] {
  const byPath = new Map(current.map((video) => [video.path.toLowerCase(), video]));
  for (const video of incoming) {
    byPath.set(video.path.toLowerCase(), video);
  }
  return Array.from(byPath.values());
}

export function attachListing(
  videos: VideoFile[],
  previous: ListedVideo[],
): ListedVideo[] {
  const prev = new Map(previous.map((video) => [video.path.toLowerCase(), video]));
  return videos.map((video) => {
    const old = prev.get(video.path.toLowerCase());
    if (!old) {
      return { ...video, status: "queued", addedAt: Date.now() };
    }
    return {
      ...video,
      status: old.status,
      audioPath: old.audioPath,
      jsonPath: old.jsonPath,
      folderPath: old.folderPath,
      txtPath: old.txtPath,
      srtPath: old.srtPath,
      outputSrtPath: old.outputSrtPath,
      bundlePath: old.bundlePath,
      trlPath: old.trlPath,
      spokenCode: old.spokenCode,
      outputCode: old.outputCode,
      segmentCount: old.segmentCount,
      durationSecs: old.durationSecs,
      error: old.error,
      percent: old.percent,
      message: old.message,
      frames: old.frames,
      addedAt: old.addedAt ?? Date.now(),
    };
  });
}

export function samePath(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function statusLabel(video: ListedVideo): string {
  switch (video.status) {
    case "queued":
      return "In elenco";
    case "extracting":
      return video.percent != null
        ? `Estrazione audio ${Math.round(video.percent)}%`
        : "Estrazione audio";
    case "audio_ready":
      return "Audio pronto";
    case "transcribing":
      return video.percent != null
        ? `Trascrizione ${Math.round(video.percent)}%`
        : "Trascrizione";
    case "transcribed":
      return video.segmentCount != null
        ? `Trascrizione pronta (${video.segmentCount} segmenti)`
        : "Trascrizione pronta";
    case "exporting":
      return "Export .txt / .srt";
    case "exported":
      return video.folderPath
        ? "Cartella di export pronta"
        : video.srtPath
          ? `Esportato ${video.srtPath.split(/[/\\]/).pop()}`
          : "File .txt e .srt pronti";
    case "translating":
      return video.percent != null
        ? `Traduzione ${Math.round(video.percent)}%`
        : "Traduzione";
    case "translated":
      return video.outputCode
        ? `Traduzione pronta (${video.spokenCode || "?"}→${video.outputCode})`
        : "Traduzione pronta";
    case "error":
      return video.error ? `Errore: ${video.error}` : "Errore";
  }
}

export function overallProgress(videos: ListedVideo[]): number {
  if (videos.length === 0) {
    return 0;
  }
  const sum = videos.reduce((acc, video) => {
    if (video.status === "translated" || video.status === "error") {
      return acc + 1;
    }
    if (video.status === "extracting") {
      return acc + ((video.percent ?? 0) / 100) * 0.25;
    }
    if (video.status === "audio_ready") {
      return acc + 0.25;
    }
    if (video.status === "transcribing") {
      return acc + 0.25 + ((video.percent ?? 0) / 100) * 0.4;
    }
    if (video.status === "transcribed" || video.status === "exporting") {
      return acc + 0.68;
    }
    if (video.status === "exported") {
      return acc + 0.75;
    }
    if (video.status === "translating") {
      return acc + 0.75 + ((video.percent ?? 0) / 100) * 0.25;
    }
    return acc;
  }, 0);
  return (sum / videos.length) * 100;
}

export function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 ** 2) {
    return `${(sizeBytes / 1024).toFixed(0)} KB`;
  }
  if (sizeBytes < 1024 ** 3) {
    return `${(sizeBytes / 1024 ** 2).toFixed(1)} MB`;
  }
  return `${(sizeBytes / 1024 ** 3).toFixed(1)} GB`;
}

export function formatClock(totalSecs: number): string {
  const secs = Math.max(0, Math.floor(totalSecs));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

export function formatMediaDuration(totalSecs: number): string {
  const secs = Math.max(0, Math.floor(totalSecs));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}
