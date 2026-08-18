import type { ListedVideo, QualityPreset, VideoJobStatus } from "./files";

export const PROJECT_FILE = "video-sub.json";

const RECENTS_KEY = "video-sub.projects";
const RECENTS_LIMIT = 24;

export type ProjectVideoSnap = {
  path: string;
  name: string;
  sizeBytes: number;
  parentDir: string;
  addedAt: number;
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
  skipTranslation?: boolean;
  error?: string;
};

export type ProjectFile = {
  version: 1;
  id: string;
  name: string;
  folder: string;
  createdAt: number;
  openedAt: number;
  spokenLang: string;
  outputLang: string;
  quality: QualityPreset;
  videos: ProjectVideoSnap[];
};

export type StudioProject = {
  id: string;
  name: string;
  folder: string;
  createdAt: number;
};

export type ProjectRecent = {
  id: string;
  name: string;
  folder: string;
  openedAt: number;
};

const QUALITIES: QualityPreset[] = ["fast", "balanced", "max"];

export function folderName(folder: string): string {
  const trimmed = folder.replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] || trimmed || "Progetto";
}

export function sameFolder(a: string, b: string): boolean {
  return a.replace(/[\\/]+$/, "").toLowerCase() === b.replace(/[\\/]+$/, "").toLowerCase();
}

export function asQuality(value: unknown): QualityPreset {
  return QUALITIES.includes(value as QualityPreset) ? (value as QualityPreset) : "balanced";
}

export function freezeStatus(video: ListedVideo): VideoJobStatus {
  switch (video.status) {
    case "extracting":
      return video.audioPath ? "audio_ready" : "queued";
    case "transcribing":
      return video.jsonPath ? "transcribed" : video.audioPath ? "audio_ready" : "queued";
    case "exporting":
      return video.srtPath ? "exported" : video.jsonPath ? "transcribed" : "queued";
    case "translating":
      if (video.trlPath || video.outputSrtPath) {
        return "translated";
      }
      return video.srtPath ? "exported" : video.jsonPath ? "transcribed" : "queued";
    default:
      return video.status;
  }
}

export function videoToSnap(video: ListedVideo): ProjectVideoSnap {
  const snap: ProjectVideoSnap = {
    path: video.path,
    name: video.name,
    sizeBytes: video.sizeBytes,
    parentDir: video.parentDir,
    addedAt: video.addedAt,
    status: freezeStatus(video),
  };
  if (video.audioPath) snap.audioPath = video.audioPath;
  if (video.jsonPath) snap.jsonPath = video.jsonPath;
  if (video.folderPath) snap.folderPath = video.folderPath;
  if (video.txtPath) snap.txtPath = video.txtPath;
  if (video.srtPath) snap.srtPath = video.srtPath;
  if (video.outputSrtPath) snap.outputSrtPath = video.outputSrtPath;
  if (video.bundlePath) snap.bundlePath = video.bundlePath;
  if (video.trlPath) snap.trlPath = video.trlPath;
  if (video.spokenCode) snap.spokenCode = video.spokenCode;
  if (video.outputCode) snap.outputCode = video.outputCode;
  if (video.segmentCount != null) snap.segmentCount = video.segmentCount;
  if (video.durationSecs != null) snap.durationSecs = video.durationSecs;
  if (video.skipTranslation) snap.skipTranslation = true;
  if (snap.status === "error" && video.error) snap.error = video.error;
  return snap;
}

export function snapToListed(snap: ProjectVideoSnap): ListedVideo {
  return {
    path: snap.path,
    name: snap.name,
    sizeBytes: snap.sizeBytes,
    parentDir: snap.parentDir,
    addedAt: snap.addedAt || Date.now(),
    status: freezeStatus({
      path: snap.path,
      name: snap.name,
      sizeBytes: snap.sizeBytes,
      parentDir: snap.parentDir,
      addedAt: snap.addedAt || Date.now(),
      status: snap.status,
      audioPath: snap.audioPath,
      jsonPath: snap.jsonPath,
      srtPath: snap.srtPath,
      trlPath: snap.trlPath,
      outputSrtPath: snap.outputSrtPath,
      error: snap.error,
    }),
    audioPath: snap.audioPath,
    jsonPath: snap.jsonPath,
    folderPath: snap.folderPath,
    txtPath: snap.txtPath,
    srtPath: snap.srtPath,
    outputSrtPath: snap.outputSrtPath,
    bundlePath: snap.bundlePath,
    trlPath: snap.trlPath,
    spokenCode: snap.spokenCode,
    outputCode: snap.outputCode,
    segmentCount: snap.segmentCount,
    durationSecs: snap.durationSecs,
    skipTranslation: snap.skipTranslation,
    error: snap.error,
  };
}

export function newProjectId(): string {
  return crypto.randomUUID();
}

export function createProjectFile(input: {
  name: string;
  folder: string;
  spokenLang: string;
  outputLang: string;
  quality: QualityPreset;
  videos?: ListedVideo[];
  id?: string;
  createdAt?: number;
}): ProjectFile {
  const now = Date.now();
  return {
    version: 1,
    id: input.id || newProjectId(),
    name: input.name.trim() || folderName(input.folder),
    folder: input.folder,
    createdAt: input.createdAt ?? now,
    openedAt: now,
    spokenLang: input.spokenLang,
    outputLang: input.outputLang,
    quality: input.quality,
    videos: (input.videos ?? []).map(videoToSnap),
  };
}

export function buildProjectFile(
  project: StudioProject,
  extras: {
    spokenLang: string;
    outputLang: string;
    quality: QualityPreset;
    videos: ListedVideo[];
  },
): ProjectFile {
  return {
    version: 1,
    id: project.id,
    name: project.name.trim() || folderName(project.folder),
    folder: project.folder,
    createdAt: project.createdAt,
    openedAt: Date.now(),
    spokenLang: extras.spokenLang,
    outputLang: extras.outputLang,
    quality: extras.quality,
    videos: extras.videos.map(videoToSnap),
  };
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseSnap(raw: unknown): ProjectVideoSnap | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const item = raw as Record<string, unknown>;
  const path = asString(item.path);
  if (!path) {
    return null;
  }
  const listed = snapToListed({
    path,
    name: asString(item.name) || folderName(path),
    sizeBytes: asNumber(item.sizeBytes) ?? 0,
    parentDir: asString(item.parentDir) || "",
    addedAt: asNumber(item.addedAt) ?? Date.now(),
    status: (asString(item.status) as VideoJobStatus) || "queued",
    audioPath: asString(item.audioPath) ?? undefined,
    jsonPath: asString(item.jsonPath) ?? undefined,
    folderPath: asString(item.folderPath) ?? undefined,
    txtPath: asString(item.txtPath) ?? undefined,
    srtPath: asString(item.srtPath) ?? undefined,
    outputSrtPath: asString(item.outputSrtPath) ?? undefined,
    bundlePath: asString(item.bundlePath) ?? undefined,
    trlPath: asString(item.trlPath) ?? undefined,
    spokenCode: asString(item.spokenCode) ?? undefined,
    outputCode: asString(item.outputCode) ?? undefined,
    segmentCount: asNumber(item.segmentCount) ?? undefined,
    durationSecs: asNumber(item.durationSecs) ?? undefined,
    skipTranslation: item.skipTranslation === true,
    error: asString(item.error) ?? undefined,
  });
  return videoToSnap(listed);
}

export function parseProjectFile(raw: unknown, folder: string): ProjectFile {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const videos = Array.isArray(obj.videos)
    ? obj.videos.map(parseSnap).filter((item): item is ProjectVideoSnap => item != null)
    : [];
  const now = Date.now();
  return {
    version: 1,
    id: asString(obj.id) || newProjectId(),
    name: asString(obj.name) || folderName(folder),
    folder,
    createdAt: asNumber(obj.createdAt) ?? now,
    openedAt: now,
    spokenLang: asString(obj.spokenLang) || "auto",
    outputLang: asString(obj.outputLang) || "it",
    quality: asQuality(obj.quality),
    videos,
  };
}

export function toStudioProject(file: ProjectFile): StudioProject {
  return {
    id: file.id,
    name: file.name,
    folder: file.folder,
    createdAt: file.createdAt,
  };
}

export function loadRecents(): ProjectRecent[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as ProjectRecent[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item) => item && asString(item.folder) && asString(item.name) && asString(item.id))
      .slice(0, RECENTS_LIMIT);
  } catch {
    return [];
  }
}

export function upsertRecent(entry: ProjectRecent): ProjectRecent[] {
  const next = [
    entry,
    ...loadRecents().filter((item) => !sameFolder(item.folder, entry.folder) && item.id !== entry.id),
  ].slice(0, RECENTS_LIMIT);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  return next;
}

export function removeRecent(folder: string): ProjectRecent[] {
  const next = loadRecents().filter((item) => !sameFolder(item.folder, folder));
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  return next;
}

export function recentFromFile(file: ProjectFile): ProjectRecent {
  return {
    id: file.id,
    name: file.name,
    folder: file.folder,
    openedAt: file.openedAt,
  };
}
