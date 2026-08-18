import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  ExtractBatchResult,
  ExportBatchResult,
  ExportJob,
  InspectResult,
  OutputExportBatchResult,
  OutputExportJob,
  ScriptFile,
  TranscribeBatchResult,
  TranscribeJob,
  TranslateBatchResult,
  TranslateJob,
  VideoPreview,
  EngineStatus,
  PreparePart,
  PrepareResult,
  SaveScriptResult,
  OpenResult,
  BurnBatchResult,
  BurnJob,
  FontItem,
  VideoSize,
} from "./files";
import { parseProjectFile, type ProjectFile } from "./projects";

const VIDEO_FILTER = {
  name: "Video",
  extensions: ["mp4", "mov", "mkv", "m4v", "avi", "webm", "mpg", "mpeg", "wmv"],
};

function asPathList(selected: string | string[] | null): string[] {
  if (selected === null) {
    return [];
  }
  return Array.isArray(selected) ? selected : [selected];
}

export async function inspectVideos(paths: string[]): Promise<InspectResult> {
  if (paths.length === 0) {
    return { videos: [], skipped: [] };
  }
  return invoke<InspectResult>("inspect_videos", { paths });
}

export async function previewVideos(videoPaths: string[]): Promise<VideoPreview[]> {
  if (videoPaths.length === 0) {
    return [];
  }
  return invoke<VideoPreview[]>("preview_videos", { videoPaths });
}

export async function openPath(path: string): Promise<OpenResult> {
  return invoke<OpenResult>("open_path", { path });
}

export async function importDavinci(
  srtPath: string,
  videoPath?: string,
): Promise<OpenResult> {
  return invoke<OpenResult>("import_davinci", { srtPath, videoPath });
}

export async function readScript(path: string): Promise<ScriptFile> {
  return invoke<ScriptFile>("read_script", { path });
}

export async function readProject(folder: string): Promise<ProjectFile | null> {
  const raw = await invoke<unknown | null>("read_project", { folder });
  if (raw == null) {
    return null;
  }
  return parseProjectFile(raw, folder);
}

export async function writeProject(folder: string, project: ProjectFile): Promise<void> {
  await invoke("write_project", { folder, project });
}

export async function engineStatus(quality = "balanced"): Promise<EngineStatus> {
  return invoke<EngineStatus>("engine_status", { quality });
}

export async function prepareModels(
  quality: string,
  parts: PreparePart = "all",
): Promise<PrepareResult> {
  return invoke<PrepareResult>("prepare_models", { quality, parts });
}

export async function saveScript(
  videoPath: string,
  path: string,
  segments: ScriptFile["segments"],
): Promise<SaveScriptResult> {
  return invoke<SaveScriptResult>("save_script", {
    items: [{ videoPath, path, segments }],
  });
}

export async function extractAudio(
  videoPaths: string[],
  outputDir: string,
): Promise<ExtractBatchResult> {
  return invoke<ExtractBatchResult>("extract_audio", {
    videoPaths,
    outputDir,
  });
}

export async function transcribeAudio(
  items: TranscribeJob[],
  language: string,
  quality: string,
  glossary: string,
): Promise<TranscribeBatchResult> {
  return invoke<TranscribeBatchResult>("transcribe_audio", {
    items,
    language,
    quality,
    glossary,
  });
}

export async function exportSource(
  items: ExportJob[],
): Promise<ExportBatchResult> {
  return invoke<ExportBatchResult>("export_source", { items });
}

export async function exportOutput(
  items: OutputExportJob[],
): Promise<OutputExportBatchResult> {
  return invoke<OutputExportBatchResult>("export_output", { items });
}

export async function translateSegments(
  items: TranslateJob[],
  targetLanguage: string,
  glossary: string,
): Promise<TranslateBatchResult> {
  return invoke<TranslateBatchResult>("translate_segments", {
    items,
    targetLanguage,
    glossary,
  });
}

export async function burnVideo(
  items: BurnJob[],
  format: string,
  resolution: string,
  outputDir: string,
  fit = "source",
): Promise<BurnBatchResult> {
  return invoke<BurnBatchResult>("burn_video", {
    items,
    format,
    resolution,
    fit,
    outputDir,
  });
}

export async function probeVideo(videoPath: string): Promise<VideoSize> {
  return invoke<VideoSize>("probe_video", { videoPath });
}

export async function listFonts(): Promise<FontItem[]> {
  const result = await invoke<{ fonts: FontItem[] }>("list_fonts");
  return result.fonts ?? [];
}

export async function inspectFont(path: string): Promise<FontItem> {
  return invoke<FontItem>("inspect_font", { path });
}

export async function pickVideoFiles(): Promise<string[]> {
  const selected = await open({
    multiple: true,
    directory: false,
    title: "Scegli i video",
    filters: [VIDEO_FILTER],
  });
  return asPathList(selected);
}

export async function pickFontFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    title: "Scegli un font",
    filters: [{ name: "Font", extensions: ["ttf", "otf", "ttc", "otc"] }],
  });
  if (selected === null) {
    return null;
  }
  return Array.isArray(selected) ? selected[0] ?? null : selected;
}

export async function pickOutputDir(title = "Cartella di output"): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title,
  });
  if (selected === null) {
    return null;
  }
  return Array.isArray(selected) ? selected[0] ?? null : selected;
}
