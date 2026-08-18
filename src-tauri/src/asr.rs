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
pub struct TranscribeProgress {
    pub video_path: String,
    pub status: String,
    pub message: String,
    pub percent: Option<f32>,
    pub json_path: Option<String>,
    pub segment_count: Option<u32>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscribeJob {
    pub video_path: String,
    pub audio_path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscribeItem {
    pub video_path: String,
    pub json_path: Option<String>,
    pub segment_count: u32,
    pub error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscribeBatchResult {
    pub items: Vec<TranscribeItem>,
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
    json_path: Option<String>,
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
    json_path: Option<String>,
    segment_count: Option<u32>,
}

fn emit_progress(app: &AppHandle, payload: TranscribeProgress) {
    let _ = app.emit("transcribe-progress", payload);
}

fn output_json_for(audio: &Path) -> PathBuf {
    let stem = audio
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("audio");
    match audio.parent() {
        Some(dir) => dir.join(format!("{stem}.asr.json")),
        None => PathBuf::from(format!("{stem}.asr.json")),
    }
}

pub fn transcribe_batch(
    app: &AppHandle,
    jobs: &[TranscribeJob],
    language: &str,
    quality: &str,
    glossary: &str,
) -> Result<TranscribeBatchResult, String> {
    if jobs.is_empty() {
        return Err("Nessun audio da trascrivere.".into());
    }

    let worker = python::resolve_script(app, "transcribe.py")?;
    let py = python::resolve_python(&worker)?;

    if !python::python_ok(&py, "import faster_whisper") {
        return Err(
            "faster-whisper non è installato. Nella cartella worker esegui:\npy -3 -m venv .venv\n.venv\\Scripts\\python.exe -m pip install -r requirements.txt"
                .into(),
        );
    }

    let first_audio = PathBuf::from(&jobs[0].audio_path);
    let request_path = match first_audio.parent() {
        Some(dir) => dir.join(".video-sub-transcribe.json"),
        None => std::env::temp_dir().join(".video-sub-transcribe.json"),
    };

    let request_jobs: Vec<_> = jobs
        .iter()
        .map(|job| {
            let audio = PathBuf::from(&job.audio_path);
            json!({
                "videoPath": job.video_path,
                "audioPath": job.audio_path,
                "outputJson": output_json_for(&audio).display().to_string(),
            })
        })
        .collect();

    let request = json!({
        "language": language,
        "quality": quality,
        "glossary": glossary,
        "jobs": request_jobs,
    });
    fs::write(
        &request_path,
        serde_json::to_string_pretty(&request).map_err(|err| err.to_string())?,
    )
    .map_err(|err| format!("Impossibile scrivere la richiesta di trascrizione: {err}"))?;

    let mut cmd = std::process::Command::new(&py.program);
    python::with_no_window(&mut cmd);
    cmd.args(&py.prefix)
        .arg(&worker)
        .arg("--batch")
        .arg(&request_path)
        .env("PYTHONUNBUFFERED", "1")
        .env("HF_HUB_DISABLE_PROGRESS_BARS", "1")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|err| format!("Impossibile avviare il worker Python: {err}"))?;

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
        emit_progress(
            app,
            TranscribeProgress {
                video_path: parsed.video_path,
                status: parsed.status,
                message: parsed.message,
                percent: parsed.percent,
                json_path: parsed.json_path,
                segment_count: parsed.segment_count,
            },
        );
    }

    let status = child
        .wait()
        .map_err(|err| format!("Worker Python interrotto: {err}"))?;
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
            format!("Risposta del worker non valida: {tail}")
        } else {
            format!("Trascrizione fallita. {tail}")
        }
    })?;

    if !parsed.ok {
        return Err(parsed
            .error
            .unwrap_or_else(|| "Trascrizione fallita.".into()));
    }

    let items = parsed
        .items
        .unwrap_or_default()
        .into_iter()
        .map(|item| TranscribeItem {
            video_path: item.video_path,
            json_path: item.json_path,
            segment_count: item.segment_count.unwrap_or(0),
            error: item.error,
        })
        .collect();

    Ok(TranscribeBatchResult { items })
}
