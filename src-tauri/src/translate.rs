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
pub struct TranslateProgress {
    pub video_path: String,
    pub status: String,
    pub message: String,
    pub percent: Option<f32>,
    pub trl_path: Option<String>,
    pub source_language: Option<String>,
    pub target_language: Option<String>,
    pub segment_count: Option<u32>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslateJob {
    pub video_path: String,
    pub json_path: String,
    #[serde(default)]
    pub source_language: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslateItem {
    pub video_path: String,
    pub trl_path: Option<String>,
    pub source_language: Option<String>,
    pub target_language: Option<String>,
    pub segment_count: u32,
    pub error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslateBatchResult {
    pub items: Vec<TranslateItem>,
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
    trl_path: Option<String>,
    source_language: Option<String>,
    target_language: Option<String>,
    segment_count: Option<u32>,
    error: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkerProgress {
    video_path: String,
    status: String,
    message: String,
    percent: Option<f32>,
    trl_path: Option<String>,
    source_language: Option<String>,
    target_language: Option<String>,
    segment_count: Option<u32>,
}

fn emit_progress(app: &AppHandle, payload: TranslateProgress) {
    let _ = app.emit("translate-progress", payload);
}

pub fn translate_batch(
    app: &AppHandle,
    jobs: &[TranslateJob],
    target_language: &str,
    glossary: &str,
) -> Result<TranslateBatchResult, String> {
    if jobs.is_empty() {
        return Err("Nessuna trascrizione da tradurre.".into());
    }

    let worker = python::resolve_script(app, "translate.py")?;
    let py = python::resolve_python(&worker)?;

    let first = PathBuf::from(&jobs[0].json_path);
    let request_path = match first.parent() {
        Some(dir) => dir.join(".video-sub-translate.json"),
        None => std::env::temp_dir().join(".video-sub-translate.json"),
    };

    let request = json!({
        "targetLanguage": target_language,
        "glossary": glossary,
        "jobs": jobs.iter().map(|job| json!({
            "videoPath": job.video_path,
            "jsonPath": job.json_path,
            "sourceLanguage": job.source_language,
        })).collect::<Vec<_>>(),
    });
    fs::write(
        &request_path,
        serde_json::to_string_pretty(&request).map_err(|err| err.to_string())?,
    )
    .map_err(|err| format!("Impossibile scrivere la richiesta di traduzione: {err}"))?;

    let mut cmd = std::process::Command::new(&py.program);
    python::with_no_window(&mut cmd);
    cmd.args(&py.prefix)
        .arg(&worker)
        .arg("--batch")
        .arg(&request_path)
        .env("PYTHONUNBUFFERED", "1")
        .env("HF_HUB_DISABLE_PROGRESS_BARS", "1")
        .current_dir(worker.parent().unwrap_or(std::path::Path::new(".")))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|err| format!("Impossibile avviare la traduzione: {err}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Impossibile leggere l’output della traduzione.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Impossibile leggere i progressi della traduzione.".to_string())?;

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
            TranslateProgress {
                video_path: parsed.video_path,
                status: parsed.status,
                message: parsed.message,
                percent: parsed.percent,
                trl_path: parsed.trl_path,
                source_language: parsed.source_language,
                target_language: parsed.target_language,
                segment_count: parsed.segment_count,
            },
        );
    }

    let status = child
        .wait()
        .map_err(|err| format!("Traduzione interrotta: {err}"))?;
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
            format!("Risposta traduzione non valida: {tail}")
        } else {
            format!("Traduzione fallita. {tail}")
        }
    })?;

    if !parsed.ok {
        return Err(parsed
            .error
            .unwrap_or_else(|| "Traduzione fallita.".into()));
    }

    let items = parsed
        .items
        .unwrap_or_default()
        .into_iter()
        .map(|item| TranslateItem {
            video_path: item.video_path,
            trl_path: item.trl_path,
            source_language: item.source_language,
            target_language: item.target_language,
            segment_count: item.segment_count.unwrap_or(0),
            error: item.error,
        })
        .collect();

    Ok(TranslateBatchResult { items })
}
