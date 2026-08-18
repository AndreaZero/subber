import type { ListedVideo, QualityPreset, VideoJobStatus } from "./files";
import { overallProgress } from "./files";

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
    hint: "Best for long interviews.",
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

export function phaseLabel(phase: RunPhase): string {
  switch (phase) {
    case "extract":
      return "Audio";
    case "transcribe":
      return "Transcription";
    case "export":
      return "Subtitles";
    case "translate":
      return "Translation";
    default:
      return "Ready";
  }
}

export function jobPhaseLabel(video: ListedVideo): string {
  switch (video.status) {
    case "queued":
      return "Ready";
    case "extracting":
      return "Extracting audio";
    case "audio_ready":
      return "Audio ready";
    case "transcribing":
      return video.spokenCode
        ? `Transcribing ${langShort(video.spokenCode)}`
        : "Transcribing";
    case "transcribed":
      return "Transcription ready";
    case "exporting":
      return "Writing subtitles";
    case "exported":
      return "Source subtitles ready";
    case "translating":
      return "Translation";
    case "translated":
      return "Complete";
    case "error":
      return "Needs attention";
  }
}

export function langShort(code: string): string {
  const map: Record<string, string> = {
    fr: "French",
    it: "Italian",
    en: "English",
    es: "Spanish",
    de: "German",
    pt: "Portuguese",
    auto: "Auto",
  };
  return map[code] ?? code.toUpperCase();
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

export function jobStages(video: ListedVideo): JobStage[] {
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
    return [
      {
        key: "audio",
        label: "Audio",
        status: failed === "audio" ? "failed" : "completed",
      },
      {
        key: "transcription",
        label: "Transcription",
        status:
          failed === "transcription"
            ? "failed"
            : failed === "audio"
              ? "pending"
              : "completed",
      },
      {
        key: "translation",
        label: "Translation",
        status: failed === "translation" ? "failed" : "pending",
      },
      {
        key: "subtitles",
        label: "Subtitles",
        status: failed === "subtitles" ? "failed" : "pending",
      },
    ];
  }

  const r = rank(video.status);
  const pct = video.percent ?? 0;

  return [
    {
      key: "audio",
      label: "Audio",
      status:
        r < 1 ? "pending" : video.status === "extracting" ? "running" : "completed",
      percent: video.status === "extracting" ? pct : r >= 2 ? 100 : undefined,
    },
    {
      key: "transcription",
      label: "Transcription",
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
    {
      key: "translation",
      label: "Translation",
      status:
        r < 7
          ? r >= 6
            ? "preparing"
            : "pending"
          : video.status === "translating"
            ? "running"
            : "completed",
      percent: video.status === "translating" ? pct : r >= 8 ? 100 : undefined,
    },
    {
      key: "subtitles",
      label: "Subtitles",
      status: r >= 8 ? "completed" : r >= 7 ? "preparing" : "pending",
      percent: r >= 8 ? 100 : undefined,
    },
  ];
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

export function friendlyError(raw: string): { title: string; hint: string } {
  const text = raw.trim();
  const lower = text.toLowerCase();
  if (lower.includes("ffmpeg")) {
    return {
      title: "FFmpeg is missing",
      hint: "Install FFmpeg, reopen the app, or set FFMPEG_PATH to ffmpeg.exe.",
    };
  }
  if (lower.includes("faster-whisper") || lower.includes("venv")) {
    return {
      title: "Transcription engine is not ready",
      hint: "Create the Python environment in the worker folder and install requirements.",
    };
  }
  if (lower.includes("nllb") || lower.includes("traduz")) {
    return {
      title: "Translation could not finish",
      hint: "Check that the translation model is installed, then retry this interview.",
    };
  }
  if (lower.includes("file non trovato") || lower.includes("not found")) {
    return {
      title: "A file could not be read",
      hint: "The video may have been moved. Add it again from disk.",
    };
  }
  return {
    title: "This interview stopped",
    hint: "Retry the job. Open Details if you need the original message.",
  };
}
