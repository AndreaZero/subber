use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::{AppHandle, Manager};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub struct Python {
    pub program: PathBuf,
    pub prefix: Vec<String>,
}

pub fn with_no_window(cmd: &mut Command) {
    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
}

pub fn python_ok(python: &Python, code: &str) -> bool {
    let mut cmd = Command::new(&python.program);
    with_no_window(&mut cmd);
    cmd.args(&python.prefix)
        .args(["-c", code])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn python_from_path(program: PathBuf, prefix: Vec<String>) -> Option<Python> {
    let python = Python { program, prefix };
    if python_ok(&python, "import sys") {
        Some(python)
    } else {
        None
    }
}

fn venv_python(worker_dir: &Path) -> Option<PathBuf> {
    let windows = worker_dir.join(".venv").join("Scripts").join("python.exe");
    if windows.is_file() {
        return Some(windows);
    }
    let unix = worker_dir.join(".venv").join("bin").join("python");
    if unix.is_file() {
        return Some(unix);
    }
    None
}

pub fn resolve_script(app: &AppHandle, filename: &str) -> Result<PathBuf, String> {
    if filename == "transcribe.py" {
        if let Ok(raw) = std::env::var("VIDEO_SUB_WORKER") {
            let path = PathBuf::from(raw.trim());
            if path.is_file() {
                return Ok(path);
            }
            return Err(format!(
                "VIDEO_SUB_WORKER non punta a transcribe.py: {}",
                path.display()
            ));
        }
    }

    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("worker")
        .join(filename);
    if dev.is_file() {
        return Ok(dev);
    }

    if let Ok(dir) = app.path().resource_dir() {
        for candidate in [dir.join(filename), dir.join("worker").join(filename)] {
            if candidate.is_file() {
                return Ok(candidate);
            }
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            for candidate in [dir.join(filename), dir.join("worker").join(filename)] {
                if candidate.is_file() {
                    return Ok(candidate);
                }
            }
        }
    }

    Err(format!("Worker Python non trovato ({filename})."))
}

pub fn resolve_python(worker: &Path) -> Result<Python, String> {
    if let Ok(raw) = std::env::var("PYTHON_PATH") {
        let path = PathBuf::from(raw.trim());
        return python_from_path(path.clone(), Vec::new()).ok_or_else(|| {
            format!("PYTHON_PATH non è un Python valido: {}", path.display())
        });
    }

    if let Some(parent) = worker.parent() {
        if let Some(venv) = venv_python(parent) {
            if let Some(python) = python_from_path(venv, Vec::new()) {
                return Ok(python);
            }
        }
    }

    #[cfg(windows)]
    {
        if let Some(python) = python_from_path(PathBuf::from("py"), vec!["-3".into()]) {
            return Ok(python);
        }
    }

    for name in ["python3", "python"] {
        if let Some(python) = python_from_path(PathBuf::from(name), Vec::new()) {
            return Ok(python);
        }
    }

    Err("Python 3 non trovato. Installa Python, crea worker/.venv, oppure imposta PYTHON_PATH.".into())
}
