use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::AppHandle;

use crate::python;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenResult {
    pub ok: bool,
    pub revealed: bool,
    pub message: Option<String>,
}

#[derive(Deserialize)]
struct WorkerStdout {
    ok: Option<bool>,
    error: Option<String>,
    message: Option<String>,
}

fn spawn_visible(cmd: &mut Command) {
    cmd.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
}

pub fn reveal_path(path: &str) -> Result<(), String> {
    let target = PathBuf::from(path);
    if !target.exists() {
        return Err(format!("Percorso non trovato: {path}"));
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = Command::new("explorer.exe");
        spawn_visible(&mut cmd);
        if target.is_dir() {
            cmd.arg(&target);
        } else {
            let displayed = target.display().to_string();
            cmd.raw_arg(format!("/select,{displayed}"));
        }
        cmd.spawn()
            .map_err(|err| format!("Impossibile aprire Esplora risorse: {err}"))?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let mut cmd = Command::new("open");
        spawn_visible(&mut cmd);
        if target.is_dir() {
            cmd.arg(&target);
        } else {
            cmd.args(["-R"]).arg(&target);
        }
        cmd.spawn()
            .map_err(|err| format!("Impossibile aprire il Finder: {err}"))?;
        return Ok(());
    }

    #[cfg(not(any(windows, target_os = "macos")))]
    {
        Err("Apertura cartella non supportata su questa piattaforma.".into())
    }
}

fn run_import(app: &AppHandle, srt: &Path, video: Option<&str>) -> Result<String, String> {
    let worker = python::resolve_script(app, "import_resolve.py")?;
    let py = python::resolve_python(app, &worker)?;
    let mut cmd = Command::new(&py.program);
    python::with_no_window(&mut cmd);
    cmd.args(&py.prefix)
        .arg(&worker)
        .arg("--srt")
        .arg(srt)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(video_path) = video {
        cmd.arg("--video").arg(video_path);
    }
    let output = cmd
        .output()
        .map_err(|err| format!("Impossibile parlare con DaVinci Resolve: {err}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let parsed: Option<WorkerStdout> = serde_json::from_str::<Value>(stdout.trim())
        .ok()
        .and_then(|value| serde_json::from_value(value).ok());
    if let Some(payload) = parsed {
        if payload.ok == Some(true) {
            return Ok(payload
                .message
                .unwrap_or_else(|| "Importato in DaVinci Resolve.".into()));
        }
        return Err(payload
            .error
            .or(payload.message)
            .unwrap_or_else(|| "Import in DaVinci non riuscito.".into()));
    }
    let tail = if !stderr.trim().is_empty() {
        stderr.trim().to_string()
    } else {
        stdout.trim().to_string()
    };
    if tail.is_empty() {
        Err("DaVinci Resolve non ha risposto. Aprilo con un progetto e riprova.".into())
    } else {
        Err(tail)
    }
}

pub fn import_davinci(
    app: &AppHandle,
    srt_path: String,
    video_path: Option<String>,
) -> Result<OpenResult, String> {
    let srt = PathBuf::from(&srt_path);
    if !srt.is_file() {
        return Err(format!("SRT non trovato: {srt_path}"));
    }
    match run_import(app, &srt, video_path.as_deref()) {
        Ok(message) => Ok(OpenResult {
            ok: true,
            revealed: false,
            message: Some(message),
        }),
        Err(error) => {
            let revealed = reveal_path(&srt_path).is_ok();
            Ok(OpenResult {
                ok: false,
                revealed,
                message: Some(error),
            })
        }
    }
}
