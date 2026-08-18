mod asr;
mod bootstrap;
mod export;
mod ffmpeg;
mod open;
mod prepare;
mod python;
mod translate;

use serde::Serialize;
use serde_json::Value;
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

fn json_f64(value: &Value) -> f64 {
    value
        .as_f64()
        .or_else(|| value.as_i64().map(|n| n as f64))
        .or_else(|| value.as_u64().map(|n| n as f64))
        .unwrap_or(0.0)
}

fn json_text(value: &Value) -> String {
    value.as_str().unwrap_or("").trim().to_string()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ScriptSegment {
    start: f64,
    end: f64,
    text: String,
    translated: Option<String>,
    speaker: Option<String>,
    confidence: Option<f64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ScriptFile {
    source_language: Option<String>,
    target_language: Option<String>,
    segments: Vec<ScriptSegment>,
}

#[tauri::command(rename_all = "camelCase")]
fn read_script(path: String) -> Result<ScriptFile, String> {
    let raw = fs::read_to_string(&path).map_err(|_| format!("Impossibile leggere {path}"))?;
    let data: Value =
        serde_json::from_str(&raw).map_err(|_| "File di testo non valido.".to_string())?;
    let source_language = data
        .get("sourceLanguage")
        .or_else(|| data.get("language"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let target_language = data
        .get("targetLanguage")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let mut segments = Vec::new();
    if let Some(list) = data.get("segments").and_then(|v| v.as_array()) {
        for item in list {
            let text = json_text(item.get("text").unwrap_or(&Value::Null));
            let translated = item
                .get("translated")
                .map(json_text)
                .filter(|s| !s.is_empty());
            if text.is_empty() && translated.is_none() {
                continue;
            }
            segments.push(ScriptSegment {
                start: json_f64(item.get("start").unwrap_or(&Value::Null)),
                end: json_f64(item.get("end").unwrap_or(&Value::Null)),
                text,
                translated,
                speaker: item
                    .get("speaker")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                confidence: item.get("confidence").map(json_f64),
            });
        }
    }
    Ok(ScriptFile {
        source_language,
        target_language,
        segments,
    })
}

#[tauri::command(rename_all = "camelCase")]
async fn preview_videos(app: AppHandle, video_paths: Vec<String>) -> Vec<ffmpeg::VideoPreview> {
    tauri::async_runtime::spawn_blocking(move || ffmpeg::preview_videos(&app, &video_paths))
        .await
        .unwrap_or_default()
}

#[tauri::command(rename_all = "camelCase")]
async fn open_path(path: String) -> Result<open::OpenResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        open::reveal_path(&path)?;
        Ok(open::OpenResult {
            ok: true,
            revealed: true,
            message: None,
        })
    })
    .await
    .map_err(|err| format!("Apertura interrotta: {err}"))?
}

#[tauri::command(rename_all = "camelCase")]
async fn import_davinci(
    app: AppHandle,
    srt_path: String,
    video_path: Option<String>,
) -> Result<open::OpenResult, String> {
    tauri::async_runtime::spawn_blocking(move || open::import_davinci(&app, srt_path, video_path))
        .await
        .map_err(|err| format!("Import DaVinci interrotto: {err}"))?
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
async fn export_output(
    app: AppHandle,
    items: Vec<export::OutputExportJob>,
) -> Result<export::OutputExportBatchResult, String> {
    tauri::async_runtime::spawn_blocking(move || export::export_output_batch(&app, &items))
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EngineStatus {
    ffmpeg_ok: bool,
    ffmpeg_path: Option<String>,
    python_ok: bool,
    python_path: Option<String>,
    whisper_ok: bool,
    translate_ok: bool,
    whisper_ready: bool,
    translate_ready: bool,
    models_ready: bool,
    whisper_model: Option<String>,
}

fn collect_engine_status(app: &AppHandle, quality: &str) -> EngineStatus {
    let ffmpeg = ffmpeg::resolve_ffmpeg().ok();
    let worker = python::resolve_script(app, "transcribe.py").ok();
    let py = worker
        .as_ref()
        .and_then(|path| python::resolve_python(app, path).ok())
        .or_else(|| python::managed_python(app));
    let python_ok = py.is_some();
    let whisper_ok = py
        .as_ref()
        .map(|runtime| python::python_ok(runtime, "import faster_whisper"))
        .unwrap_or(false);
    let translate_ok = py
        .as_ref()
        .map(|runtime| python::python_ok(runtime, "import ctranslate2, transformers"))
        .unwrap_or(false);
    let models = if python_ok {
        prepare::check_models(app, quality)
    } else {
        prepare::PrepareResult {
            whisper_ready: false,
            translate_ready: false,
            models_ready: false,
            whisper_model: None,
        }
    };
    EngineStatus {
        ffmpeg_ok: ffmpeg.is_some(),
        ffmpeg_path: ffmpeg.map(|path| path.display().to_string()),
        python_ok,
        python_path: py.map(|runtime| runtime.program.display().to_string()),
        whisper_ok,
        translate_ok,
        whisper_ready: models.whisper_ready,
        translate_ready: models.translate_ready,
        models_ready: models.models_ready,
        whisper_model: models.whisper_model,
    }
}

#[tauri::command(rename_all = "camelCase")]
async fn engine_status(app: AppHandle, quality: Option<String>) -> EngineStatus {
    let quality = quality.unwrap_or_else(|| "balanced".into());
    tauri::async_runtime::spawn_blocking(move || collect_engine_status(&app, &quality))
        .await
        .unwrap_or(EngineStatus {
            ffmpeg_ok: false,
            ffmpeg_path: None,
            python_ok: false,
            python_path: None,
            whisper_ok: false,
            translate_ok: false,
            whisper_ready: false,
            translate_ready: false,
            models_ready: false,
            whisper_model: None,
        })
}

#[tauri::command(rename_all = "camelCase")]
async fn prepare_models(
    app: AppHandle,
    quality: String,
    parts: Option<String>,
) -> Result<prepare::PrepareResult, String> {
    let parts = parts.unwrap_or_else(|| "all".into());
    tauri::async_runtime::spawn_blocking(move || prepare::prepare_models(&app, &quality, &parts))
        .await
        .map_err(|err| format!("Download modelli interrotto: {err}"))?
}

#[tauri::command(rename_all = "camelCase")]
async fn save_script(
    app: AppHandle,
    items: Vec<export::SaveScriptJob>,
) -> Result<export::SaveScriptResult, String> {
    tauri::async_runtime::spawn_blocking(move || export::save_script(&app, &items))
        .await
        .map_err(|err| format!("Salvataggio interrotto: {err}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            inspect_videos,
            preview_videos,
            open_path,
            import_davinci,
            read_script,
            engine_status,
            prepare_models,
            extract_audio,
            transcribe_audio,
            export_source,
            export_output,
            translate_segments,
            save_script
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
