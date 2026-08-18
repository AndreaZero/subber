use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tauri::{AppHandle, Emitter};

use crate::python;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportProgress {
    pub video_path: String,
    pub status: String,
    pub message: String,
    pub percent: Option<f32>,
    pub folder_path: Option<String>,
    pub txt_path: Option<String>,
    pub srt_path: Option<String>,
    pub json_path: Option<String>,
    pub language: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportJob {
    pub video_path: String,
    pub json_path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportItem {
    pub video_path: String,
    pub folder_path: Option<String>,
    pub txt_path: Option<String>,
    pub srt_path: Option<String>,
    pub language: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportBatchResult {
    pub items: Vec<ExportItem>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputExportJob {
    pub video_path: String,
    pub trl_path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputExportItem {
    pub video_path: String,
    pub folder_path: Option<String>,
    pub srt_path: Option<String>,
    pub json_path: Option<String>,
    pub language: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputExportBatchResult {
    pub items: Vec<OutputExportItem>,
}

#[derive(Deserialize)]
struct WorkerStdout {
    ok: bool,
    error: Option<String>,
    items: Option<serde_json::Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SourceWorkerItem {
    video_path: String,
    folder_path: Option<String>,
    txt_path: Option<String>,
    srt_path: Option<String>,
    language: Option<String>,
    error: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutputWorkerItem {
    video_path: String,
    folder_path: Option<String>,
    srt_path: Option<String>,
    json_path: Option<String>,
    language: Option<String>,
    error: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkerProgress {
    video_path: String,
    status: String,
    message: String,
    percent: Option<f32>,
    folder_path: Option<String>,
    txt_path: Option<String>,
    srt_path: Option<String>,
    json_path: Option<String>,
    language: Option<String>,
}

fn emit_progress(app: &AppHandle, event: &str, payload: ExportProgress) {
    let _ = app.emit(event, payload);
}

fn request_path_for(sidecar: &str) -> PathBuf {
    let first = PathBuf::from(sidecar);
    match first.parent() {
        Some(dir) => dir.join(".video-sub-export.json"),
        None => std::env::temp_dir().join(".video-sub-export.json"),
    }
}

fn run_export_worker(
    app: &AppHandle,
    script: &str,
    request_path: &Path,
    request: serde_json::Value,
    progress_event: &str,
) -> Result<WorkerStdout, String> {
    let worker = python::resolve_script(app, script)?;
    let py = python::resolve_python(&worker)?;

    fs::write(
        request_path,
        serde_json::to_string_pretty(&request).map_err(|err| err.to_string())?,
    )
    .map_err(|err| format!("Impossibile scrivere la richiesta di export: {err}"))?;

    let mut cmd = std::process::Command::new(&py.program);
    python::with_no_window(&mut cmd);
    cmd.args(&py.prefix)
        .arg(&worker)
        .arg("--batch")
        .arg(request_path)
        .env("PYTHONUNBUFFERED", "1")
        .current_dir(worker.parent().unwrap_or(std::path::Path::new(".")))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|err| format!("Impossibile avviare l’export: {err}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Impossibile leggere l’output dell’export.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Impossibile leggere i progressi dell’export.".to_string())?;

    let stdout_thread = std::thread::spawn(move || {
        let mut text = String::new();
        let _ = BufReader::new(stdout).read_to_string(&mut text);
        text
    });

    for line in BufReader::new(stderr).lines().flatten() {
        let Ok(parsed) = serde_json::from_str::<WorkerProgress>(&line) else {
            continue;
        };
        emit_progress(
            app,
            progress_event,
            ExportProgress {
                video_path: parsed.video_path,
                status: parsed.status,
                message: parsed.message,
                percent: parsed.percent,
                folder_path: parsed.folder_path,
                txt_path: parsed.txt_path,
                srt_path: parsed.srt_path,
                json_path: parsed.json_path,
                language: parsed.language,
            },
        );
    }

    let status = child
        .wait()
        .map_err(|err| format!("Export interrotto: {err}"))?;
    let stdout_text = stdout_thread.join().unwrap_or_default();
    let _ = fs::remove_file(request_path);

    let parsed: WorkerStdout = serde_json::from_str(stdout_text.trim()).map_err(|_| {
        let tail: String = stdout_text
            .chars()
            .rev()
            .take(600)
            .collect::<String>()
            .chars()
            .rev()
            .collect();
        if status.success() {
            format!("Risposta export non valida: {tail}")
        } else {
            format!("Export fallito. {tail}")
        }
    })?;

    if !parsed.ok {
        return Err(parsed.error.unwrap_or_else(|| "Export fallito.".into()));
    }

    Ok(parsed)
}

pub fn export_source_batch(app: &AppHandle, jobs: &[ExportJob]) -> Result<ExportBatchResult, String> {
    if jobs.is_empty() {
        return Err("Nessuna trascrizione da esportare.".into());
    }

    let request_path = request_path_for(&jobs[0].json_path);
    let request = json!({
        "jobs": jobs.iter().map(|job| json!({
            "videoPath": job.video_path,
            "jsonPath": job.json_path,
        })).collect::<Vec<_>>(),
    });
    let parsed = run_export_worker(app, "export_source.py", &request_path, request, "export-progress")?;
    let items = serde_json::from_value::<Vec<SourceWorkerItem>>(parsed.items.unwrap_or(json!([])))
        .map_err(|err| format!("Risposta export non valida: {err}"))?
        .into_iter()
        .map(|item| ExportItem {
            video_path: item.video_path,
            folder_path: item.folder_path,
            txt_path: item.txt_path,
            srt_path: item.srt_path,
            language: item.language,
            error: item.error,
        })
        .collect();

    Ok(ExportBatchResult { items })
}

pub fn export_output_batch(
    app: &AppHandle,
    jobs: &[OutputExportJob],
) -> Result<OutputExportBatchResult, String> {
    if jobs.is_empty() {
        return Err("Nessuna traduzione da esportare.".into());
    }

    let request_path = match PathBuf::from(&jobs[0].trl_path).parent() {
        Some(dir) => dir.join(".video-sub-export-out.json"),
        None => std::env::temp_dir().join(".video-sub-export-out.json"),
    };
    let request = json!({
        "jobs": jobs.iter().map(|job| json!({
            "videoPath": job.video_path,
            "trlPath": job.trl_path,
        })).collect::<Vec<_>>(),
    });
    let parsed = run_export_worker(
        app,
        "export_output.py",
        &request_path,
        request,
        "export-output-progress",
    )?;
    let items = serde_json::from_value::<Vec<OutputWorkerItem>>(parsed.items.unwrap_or(json!([])))
        .map_err(|err| format!("Risposta export non valida: {err}"))?
        .into_iter()
        .map(|item| OutputExportItem {
            video_path: item.video_path,
            folder_path: item.folder_path,
            srt_path: item.srt_path,
            json_path: item.json_path,
            language: item.language,
            error: item.error,
        })
        .collect();

    Ok(OutputExportBatchResult { items })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveScriptJob {
    pub video_path: String,
    pub path: String,
    pub segments: serde_json::Value,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveScriptItem {
    pub video_path: String,
    pub path: Option<String>,
    pub folder_path: Option<String>,
    pub srt_path: Option<String>,
    pub json_path: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveScriptResult {
    pub items: Vec<SaveScriptItem>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveWorkerItem {
    video_path: String,
    path: Option<String>,
    folder_path: Option<String>,
    srt_path: Option<String>,
    json_path: Option<String>,
    error: Option<String>,
}

pub fn save_script(app: &AppHandle, jobs: &[SaveScriptJob]) -> Result<SaveScriptResult, String> {
    if jobs.is_empty() {
        return Err("Niente da salvare.".into());
    }

    let request_path = match PathBuf::from(&jobs[0].path).parent() {
        Some(dir) => dir.join(".video-sub-save.json"),
        None => std::env::temp_dir().join(".video-sub-save.json"),
    };
    let request = json!({
        "jobs": jobs.iter().map(|job| json!({
            "videoPath": job.video_path,
            "path": job.path,
            "segments": job.segments,
        })).collect::<Vec<_>>(),
    });
    let parsed = run_export_worker(app, "save_script.py", &request_path, request, "save-script-progress")?;
    let items = serde_json::from_value::<Vec<SaveWorkerItem>>(parsed.items.unwrap_or(json!([])))
        .map_err(|err| format!("Risposta salvataggio non valida: {err}"))?
        .into_iter()
        .map(|item| SaveScriptItem {
            video_path: item.video_path,
            path: item.path,
            folder_path: item.folder_path,
            srt_path: item.srt_path,
            json_path: item.json_path,
            error: item.error,
        })
        .collect();

    Ok(SaveScriptResult { items })
}
