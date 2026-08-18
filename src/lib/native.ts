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
} from "./files";

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

export async function readScript(path: string): Promise<ScriptFile> {
  return invoke<ScriptFile>("read_script", { path });
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

export async function pickVideoFiles(): Promise<string[]> {
  const selected = await open({
    multiple: true,
    directory: false,
    title: "Scegli i video delle interviste",
    filters: [VIDEO_FILTER],
  });
  return asPathList(selected);
}

export async function pickOutputDir(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Cartella di output",
  });
  if (selected === null) {
    return null;
  }
  return Array.isArray(selected) ? selected[0] ?? null : selected;
}
