mod asr;
mod export;
mod ffmpeg;
mod python;
mod translate;

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

const VIDEO_EXTENSIONS: &[&str] = &[
    "mp4", "mov", "mkv", "m4v", "avi", "webm", "mpg", "mpeg", "wmv",
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VideoFile {
    path: String,
    name: String,
    size_bytes: u64,
    parent_dir: String,
}

#[derive(Serialize)]
struct SkippedFile {
    path: String,
    reason: String,
}

#[derive(Serialize)]
struct InspectResult {
    videos: Vec<VideoFile>,
    skipped: Vec<SkippedFile>,
}

fn is_video_path(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            VIDEO_EXTENSIONS
                .iter()
                .any(|allowed| ext.eq_ignore_ascii_case(allowed))
        })
        .unwrap_or(false)
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("video")
        .to_string()
}

fn parent_dir(path: &Path) -> String {
    path.parent()
        .map(|parent| parent.display().to_string())
        .unwrap_or_default()
}

fn push_file(videos: &mut Vec<VideoFile>, skipped: &mut Vec<SkippedFile>, path: PathBuf) {
    let display = path.display().to_string();
    match fs::metadata(&path) {
        Ok(meta) if meta.is_file() => videos.push(VideoFile {
            path: display,
            name: file_name(&path),
            size_bytes: meta.len(),
            parent_dir: parent_dir(&path),
        }),
        _ => skipped.push(SkippedFile {
            path: display,
            reason: "Impossibile leggere il file".into(),
        }),
    }
}

fn collect_path(videos: &mut Vec<VideoFile>, skipped: &mut Vec<SkippedFile>, path: PathBuf) {
    let display = path.display().to_string();

    if !path.exists() {
        skipped.push(SkippedFile {
            path: display,
            reason: "File non trovato".into(),
        });
        return;
    }

    if path.is_dir() {
        let mut found = 0usize;
        match fs::read_dir(&path) {
            Ok(entries) => {
                for entry in entries.flatten() {
                    let child = entry.path();
                    if child.is_file() && is_video_path(&child) {
                        push_file(videos, skipped, child);
                        found += 1;
                    }
                }
            }
            Err(_) => {
                skipped.push(SkippedFile {
                    path: display,
                    reason: "Cartella non leggibile".into(),
                });
                return;
            }
        }
        if found == 0 {
            skipped.push(SkippedFile {
                path: display,
                reason: "Nessun video in questa cartella".into(),
            });
        }
        return;
    }

    if !is_video_path(&path) {
        skipped.push(SkippedFile {
            path: display,
            reason: "Non è un file video".into(),
        });
        return;
    }

    push_file(videos, skipped, path);
}

#[tauri::command]
fn inspect_videos(paths: Vec<String>) -> InspectResult {
    let mut videos = Vec::new();
    let mut skipped = Vec::new();

    for path in paths {
        collect_path(&mut videos, &mut skipped, PathBuf::from(path));
    }

    videos.sort_by(|a, b| a.path.to_lowercase().cmp(&b.path.to_lowercase()));
    videos.dedup_by(|a, b| a.path.eq_ignore_ascii_case(&b.path));

    InspectResult { videos, skipped }
}

#[tauri::command(rename_all = "camelCase")]
async fn extract_audio(
    app: AppHandle,
    video_paths: Vec<String>,
    output_dir: String,
) -> Result<ffmpeg::ExtractBatchResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        ffmpeg::extract_audio_batch(&app, &video_paths, &output_dir)
    })
    .await
    .map_err(|err| format!("Estrazione interrotta: {err}"))?
}

#[tauri::command(rename_all = "camelCase")]
async fn transcribe_audio(
    app: AppHandle,
    items: Vec<asr::TranscribeJob>,
    language: String,
    quality: String,
    glossary: String,
) -> Result<asr::TranscribeBatchResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        asr::transcribe_batch(&app, &items, &language, &quality, &glossary)
    })
    .await
    .map_err(|err| format!("Trascrizione interrotta: {err}"))?
}

#[tauri::command(rename_all = "camelCase")]
async fn export_source(
    app: AppHandle,
    items: Vec<export::ExportJob>,
) -> Result<export::ExportBatchResult, String> {
    tauri::async_runtime::spawn_blocking(move || export::export_source_batch(&app, &items))
        .await
        .map_err(|err| format!("Export interrotto: {err}"))?
}

#[tauri::command(rename_all = "camelCase")]
async fn translate_segments(
    app: AppHandle,
    items: Vec<translate::TranslateJob>,
    target_language: String,
    glossary: String,
) -> Result<translate::TranslateBatchResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        translate::translate_batch(&app, &items, &target_language, &glossary)
    })
    .await
    .map_err(|err| format!("Traduzione interrotta: {err}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            inspect_videos,
            extract_audio,
            transcribe_audio,
            export_source,
            translate_segments
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
