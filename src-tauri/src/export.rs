use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::PathBuf;
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
    pub txt_path: Option<String>,
    pub srt_path: Option<String>,
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
struct WorkerStdout {
    ok: bool,
    error: Option<String>,
    items: Option<Vec<WorkerItem>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkerItem {
    video_path: String,
    txt_path: Option<String>,
    srt_path: Option<String>,
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
    txt_path: Option<String>,
    srt_path: Option<String>,
    language: Option<String>,
}

fn emit_progress(app: &AppHandle, payload: ExportProgress) {
    let _ = app.emit("export-progress", payload);
}

pub fn export_source_batch(app: &AppHandle, jobs: &[ExportJob]) -> Result<ExportBatchResult, String> {
    if jobs.is_empty() {
        return Err("Nessuna trascrizione da esportare.".into());
    }

    let worker = python::resolve_script(app, "export_source.py")?;
    let py = python::resolve_python(&worker)?;

    let first = PathBuf::from(&jobs[0].json_path);
    let request_path = match first.parent() {
        Some(dir) => dir.join(".video-sub-export.json"),
        None => std::env::temp_dir().join(".video-sub-export.json"),
    };

    let request = json!({
        "jobs": jobs.iter().map(|job| json!({
            "videoPath": job.video_path,
            "jsonPath": job.json_path,
        })).collect::<Vec<_>>(),
    });
    fs::write(
        &request_path,
        serde_json::to_string_pretty(&request).map_err(|err| err.to_string())?,
    )
    .map_err(|err| format!("Impossibile scrivere la richiesta di export: {err}"))?;

    let mut cmd = std::process::Command::new(&py.program);
    python::with_no_window(&mut cmd);
    cmd.args(&py.prefix)
        .arg(&worker)
        .arg("--batch")
        .arg(&request_path)
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
            ExportProgress {
                video_path: parsed.video_path,
                status: parsed.status,
                message: parsed.message,
                percent: parsed.percent,
                txt_path: parsed.txt_path,
                srt_path: parsed.srt_path,
                language: parsed.language,
            },
        );
    }

    let status = child
        .wait()
        .map_err(|err| format!("Export interrotto: {err}"))?;
    let stdout_text = stdout_thread.join().unwrap_or_default();
    let _ = fs::remove_file(&request_path);

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

    let items = parsed
        .items
        .unwrap_or_default()
        .into_iter()
        .map(|item| ExportItem {
            video_path: item.video_path,
            txt_path: item.txt_path,
            srt_path: item.srt_path,
            language: item.language,
            error: item.error,
        })
        .collect();

    Ok(ExportBatchResult { items })
}
