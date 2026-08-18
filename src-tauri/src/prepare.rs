use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{BufRead, BufReader, Read};
use std::process::Stdio;
use tauri::{AppHandle, Emitter};

use crate::python;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareProgress {
    pub status: String,
    pub part: String,
    pub message: String,
    pub percent: Option<f32>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareResult {
    pub whisper_ready: bool,
    pub translate_ready: bool,
    pub models_ready: bool,
    pub whisper_model: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkerStdout {
    ok: Option<bool>,
    error: Option<String>,
    whisper_ready: Option<bool>,
    translate_ready: Option<bool>,
    models_ready: Option<bool>,
    whisper_model: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkerProgress {
    status: Option<String>,
    part: Option<String>,
    message: Option<String>,
    percent: Option<f32>,
}

fn emit_progress(app: &AppHandle, payload: PrepareProgress) {
    let _ = app.emit("prepare-progress", payload);
}

fn run_prepare(
    app: &AppHandle,
    quality: &str,
    download: bool,
    parts: &str,
    emit: bool,
) -> Result<PrepareResult, String> {
    let worker = python::resolve_script(app, "prepare.py")?;
    let py = python::resolve_python(&worker)?;

    let mut cmd = std::process::Command::new(&py.program);
    python::with_no_window(&mut cmd);
    cmd.args(&py.prefix).arg(&worker).arg("--quality").arg(quality);
    if download {
        cmd.arg("--download").arg("--parts").arg(parts);
    } else {
        cmd.arg("--check");
    }
    cmd.env("PYTHONUNBUFFERED", "1")
        .env("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|err| format!("Impossibile avviare il download modelli: {err}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Impossibile leggere l’output del worker.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Impossibile leggere i progressi del worker.".to_string())?;

    let stdout_thread = std::thread::spawn(move || {
        let mut text = String::new();
        let _ = BufReader::new(stdout).read_to_string(&mut text);
        text
    });

    for line in BufReader::new(stderr).lines().flatten() {
        let Ok(parsed) = serde_json::from_str::<WorkerProgress>(&line) else {
            continue;
        };
        if emit {
            emit_progress(
                app,
                PrepareProgress {
                    status: parsed.status.unwrap_or_else(|| "downloading".into()),
                    part: parsed.part.unwrap_or_else(|| "engine".into()),
                    message: parsed.message.unwrap_or_default(),
                    percent: parsed.percent,
                },
            );
        }
    }

    let status = child
        .wait()
        .map_err(|err| format!("Worker modelli interrotto: {err}"))?;
    let stdout_text = stdout_thread.join().unwrap_or_default();

    let parsed: WorkerStdout = serde_json::from_str::<Value>(stdout_text.trim())
        .ok()
        .and_then(|value| serde_json::from_value(value).ok())
        .ok_or_else(|| {
            let tail: String = stdout_text
                .chars()
                .rev()
                .take(600)
                .collect::<String>()
                .chars()
                .rev()
                .collect();
            if status.success() {
                format!("Risposta modelli non valida: {tail}")
            } else {
                format!("Download modelli fallito. {tail}")
            }
        })?;

    if parsed.ok == Some(false) {
        return Err(parsed
            .error
            .unwrap_or_else(|| "Download modelli fallito.".into()));
    }

    Ok(PrepareResult {
        whisper_ready: parsed.whisper_ready.unwrap_or(false),
        translate_ready: parsed.translate_ready.unwrap_or(false),
        models_ready: parsed.models_ready.unwrap_or(false),
        whisper_model: parsed.whisper_model,
    })
}

pub fn check_models(app: &AppHandle, quality: &str) -> PrepareResult {
    run_prepare(app, quality, false, "all", false).unwrap_or(PrepareResult {
        whisper_ready: false,
        translate_ready: false,
        models_ready: false,
        whisper_model: None,
    })
}

pub fn prepare_models(app: &AppHandle, quality: &str, parts: &str) -> Result<PrepareResult, String> {
    run_prepare(app, quality, true, parts, true)
}
