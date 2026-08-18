import type { ListedVideo, QualityPreset, VideoJobStatus } from "./files";
import { overallProgress } from "./files";
import { languageName } from "./languages";
import { t, type UiLang } from "./i18n";

export type NavId = "home" | "jobs" | "history" | "glossary" | "settings";

export type RunPhase =
  | "extract"
  | "transcribe"
  | "export"
  | "translate"
  | null;

export type StageKey = "audio" | "transcription" | "translation" | "subtitles";

export type StageStatus =
  | "pending"
  | "preparing"
  | "running"
  | "completed"
  | "warning"
  | "failed";

export type JobStage = {
  key: StageKey;
  label: string;
  status: StageStatus;
  percent?: number;
};

export type QualityInfo = {
  id: QualityPreset;
  label: string;
  hint: string;
  asr: string;
  beam: number;
  vad: boolean;
};

export const QUALITY_PRESETS: QualityInfo[] = [
  {
    id: "fast",
    label: "Fast",
    hint: "Quick draft. Whisper base.",
    asr: "Whisper base",
    beam: 1,
    vad: true,
  },
  {
    id: "balanced",
    label: "Balanced",
    hint: "Best for long videos.",
    asr: "Whisper small",
    beam: 5,
    vad: true,
  },
  {
    id: "max",
    label: "Best Quality",
    hint: "Highest accuracy. Slower.",
    asr: "Whisper large-v3",
    beam: 5,
    vad: true,
  },
];

export const TRANSLATION_MODEL = "NLLB-200 distilled";

const ACTIVE: VideoJobStatus[] = [
  "extracting",
  "transcribing",
  "exporting",
  "translating",
];

export function isActiveStatus(status: VideoJobStatus): boolean {
  return ACTIVE.includes(status);
}

export function qualityInfo(id: QualityPreset): QualityInfo {
  return QUALITY_PRESETS.find((item) => item.id === id) ?? QUALITY_PRESETS[1];
}

export function qualityLabel(id: QualityPreset, lang: UiLang): string {
  switch (id) {
    case "fast":
      return t(lang, "qualityFast");
    case "max":
      return t(lang, "qualityMax");
    default:
      return t(lang, "qualityBalanced");
  }
}

export function qualityHint(id: QualityPreset, lang: UiLang): string {
  switch (id) {
    case "fast":
      return t(lang, "qualityFastHint");
    case "max":
      return t(lang, "qualityMaxHint");
    default:
      return t(lang, "qualityBalancedHint");
  }
}

export function phaseLabel(phase: RunPhase, lang: UiLang): string {
  switch (phase) {
    case "extract":
      return t(lang, "phaseAudio");
    case "transcribe":
      return t(lang, "phaseTranscription");
    case "export":
      return t(lang, "phaseSubtitles");
    case "translate":
      return t(lang, "phaseTranslation");
    default:
      return t(lang, "phaseReady");
  }
}

export function jobPhaseLabel(video: ListedVideo, lang: UiLang): string {
  switch (video.status) {
    case "queued":
      return t(lang, "jobQueued");
    case "extracting":
      return t(lang, "jobExtracting");
    case "audio_ready":
      return t(lang, "jobAudioReady");
    case "transcribing":
      return video.spokenCode
        ? t(lang, "jobTranscribingLang", { lang: languageName(video.spokenCode, lang) })
        : t(lang, "jobTranscribing");
    case "transcribed":
      return t(lang, "jobTranscribed");
    case "exporting":
      return t(lang, "jobExporting");
    case "exported":
      return t(lang, "jobExported");
    case "translating":
      return t(lang, "jobTranslating");
    case "translated":
      return t(lang, "jobTranslated");
    case "error":
      return t(lang, "jobError");
  }
}

export function langShort(code: string, lang: UiLang = "it"): string {
  if (code === "auto") {
    return t(lang, "auto");
  }
  return languageName(code, lang);
}

export function langCodeLabel(code: string): string {
  if (code === "auto") {
    return "Auto";
  }
  return code.toUpperCase();
}

function rank(status: VideoJobStatus): number {
  switch (status) {
    case "queued":
      return 0;
    case "extracting":
      return 1;
    case "audio_ready":
      return 2;
    case "transcribing":
      return 3;
    case "transcribed":
      return 4;
    case "exporting":
      return 5;
    case "exported":
      return 6;
    case "translating":
      return 7;
    case "translated":
      return 8;
    case "error":
      return -1;
  }
}

export function wantsTranslation(
  spoken: string,
  output: string,
  detected?: string | null,
): boolean {
  const dst = output.trim().toLowerCase();
  const src = (detected || "").trim().toLowerCase();
  if (src) {
    return src !== dst;
  }
  const chosen = spoken.trim().toLowerCase();
  if (chosen && chosen !== "auto") {
    return chosen !== dst;
  }
  return true;
}

export function jobStages(video: ListedVideo, lang: UiLang, translate = true): JobStage[] {
  const showTranslate = translate && !video.skipTranslation;
  if (video.status === "error") {
    const failed: StageKey =
      video.message?.toLowerCase().includes("ffmpeg") ||
      video.error?.toLowerCase().includes("ffmpeg") ||
      video.error?.toLowerCase().includes("audio")
        ? "audio"
        : video.error?.toLowerCase().includes("traduz") ||
            video.error?.toLowerCase().includes("translat")
          ? "translation"
          : video.error?.toLowerCase().includes("export") ||
              video.error?.toLowerCase().includes("srt")
            ? "subtitles"
            : "transcription";
    const stages: JobStage[] = [
      {
        key: "audio",
        label: t(lang, "stageAudio"),
        status: failed === "audio" ? "failed" : "completed",
      },
      {
        key: "transcription",
        label: t(lang, "stageTranscription"),
        status:
          failed === "transcription"
            ? "failed"
            : failed === "audio"
              ? "pending"
              : "completed",
      },
    ];
    if (showTranslate) {
      stages.push({
        key: "translation",
        label: t(lang, "stageTranslation"),
        status: failed === "translation" ? "failed" : "pending",
      });
    }
    stages.push({
      key: "subtitles",
      label: t(lang, "stageSubtitles"),
      status: failed === "subtitles" ? "failed" : "pending",
    });
    return stages;
  }

  const r = rank(video.status);
  const pct = video.percent ?? 0;
  const stages: JobStage[] = [
    {
      key: "audio",
      label: t(lang, "stageAudio"),
      status:
        r < 1 ? "pending" : video.status === "extracting" ? "running" : "completed",
      percent: video.status === "extracting" ? pct : r >= 2 ? 100 : undefined,
    },
    {
      key: "transcription",
      label: t(lang, "stageTranscription"),
      status:
        r < 3
          ? r === 2
            ? "preparing"
            : "pending"
          : video.status === "transcribing" || video.status === "exporting"
            ? "running"
            : "completed",
      percent:
        video.status === "transcribing" || video.status === "exporting"
          ? pct
          : r >= 4
            ? 100
            : undefined,
    },
  ];
  if (showTranslate) {
    stages.push({
      key: "translation",
      label: t(lang, "stageTranslation"),
      status:
        r < 7
          ? r >= 6
            ? "preparing"
            : "pending"
          : video.status === "translating"
            ? "running"
            : "completed",
      percent: video.status === "translating" ? pct : r >= 8 ? 100 : undefined,
    });
    stages.push({
      key: "subtitles",
      label: t(lang, "stageSubtitles"),
      status: r >= 8 ? "completed" : r >= 7 ? "preparing" : "pending",
      percent: r >= 8 ? 100 : undefined,
    });
  } else {
    stages.push({
      key: "subtitles",
      label: t(lang, "stageSubtitles"),
      status:
        r >= 8 || video.status === "exported"
          ? "completed"
          : video.status === "exporting"
            ? "running"
            : r >= 4
              ? "preparing"
              : "pending",
      percent:
        video.status === "exporting"
          ? pct
          : r >= 8 || video.status === "exported"
            ? 100
            : undefined,
    });
  }
  return stages;
}

export function workspaceMode(
  videos: ListedVideo[],
  working: boolean,
): "empty" | "queue" | "processing" | "completed" {
  if (videos.length === 0) {
    return "empty";
  }
  if (working || videos.some((video) => isActiveStatus(video.status))) {
    return "processing";
  }
  if (
    videos.length > 0 &&
    videos.every((video) => video.status === "translated" || video.status === "error") &&
    videos.some((video) => video.status === "translated")
  ) {
    return "completed";
  }
  return "queue";
}

export function completedCount(videos: ListedVideo[]): number {
  return videos.filter((video) => video.status === "translated").length;
}

export function failedCount(videos: ListedVideo[]): number {
  return videos.filter((video) => video.status === "error").length;
}

export function processedMediaSecs(videos: ListedVideo[]): number {
  return videos.reduce((sum, video) => {
    const duration = video.durationSecs ?? 0;
    if (duration <= 0) {
      return sum;
    }
    const unit = overallProgress([video]) / 100;
    return sum + duration * unit;
  }, 0);
}

export function hashHue(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

export function friendlyError(raw: string, lang: UiLang): { title: string; hint: string } {
  const text = raw.trim();
  const lower = text.toLowerCase();
  if (lower.includes("ffmpeg")) {
    return { title: t(lang, "errFfmpegTitle"), hint: t(lang, "errFfmpegHint") };
  }
  if (lower.includes("faster-whisper") || lower.includes("venv")) {
    return { title: t(lang, "errAsrTitle"), hint: t(lang, "errAsrHint") };
  }
  if (lower.includes("nllb") || lower.includes("traduz") || lower.includes("ctranslate") || lower.includes("transformers")) {
    return { title: t(lang, "errTrlTitle"), hint: t(lang, "errTrlHint") };
  }
  if (lower.includes("python")) {
    return { title: t(lang, "errAsrTitle"), hint: t(lang, "errAsrHint") };
  }
  if (lower.includes("file non trovato") || lower.includes("not found")) {
    return { title: t(lang, "errFileTitle"), hint: t(lang, "errFileHint") };
  }
  return { title: t(lang, "errGenericTitle"), hint: t(lang, "errGenericHint") };
}
