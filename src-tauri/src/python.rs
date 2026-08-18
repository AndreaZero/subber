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

pub fn packages_ok(python: &Python) -> bool {
    python_ok(python, "import faster_whisper, ctranslate2, transformers, sentencepiece")
}

fn python_from_path(program: PathBuf, prefix: Vec<String>) -> Option<Python> {
    let python = Python { program, prefix };
    if python_ok(&python, "import sys") {
        Some(python)
    } else {
        None
    }
}

pub fn python_in_venv(venv: &Path) -> Option<PathBuf> {
    let windows = venv.join("Scripts").join("python.exe");
    if windows.is_file() {
        return Some(windows);
    }
    let unix = venv.join("bin").join("python3");
    if unix.is_file() {
        return Some(unix);
    }
    let unix_plain = venv.join("bin").join("python");
    if unix_plain.is_file() {
        return Some(unix_plain);
    }
    None
}

pub fn runtime_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("runtime"))
        .map_err(|err| format!("Cartella dati app non disponibile: {err}"))
}

pub fn venv_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(runtime_dir(app)?.join("venv"))
}

pub fn managed_python(app: &AppHandle) -> Option<Python> {
    let venv = venv_dir(app).ok()?;
    python_from_path(python_in_venv(&venv)?, Vec::new())
}

pub fn executable_path(python: &Python) -> Option<PathBuf> {
    let mut cmd = Command::new(&python.program);
    with_no_window(&mut cmd);
    cmd.args(&python.prefix)
        .args(["-c", "import sys; print(sys.executable)"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    let output = cmd.output().ok()?;
    if !output.status.success() {
        return None;
    }
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path.is_empty() {
        return None;
    }
    Some(PathBuf::from(path))
}

pub fn system_python() -> Option<Python> {
    #[cfg(windows)]
    {
        if let Some(python) = python_from_path(PathBuf::from("py"), vec!["-3".into()]) {
            return Some(python);
        }
    }
    for name in ["python3", "python"] {
        if let Some(python) = python_from_path(PathBuf::from(name), Vec::new()) {
            return Some(python);
        }
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

pub fn resolve_python(app: &AppHandle, worker: &Path) -> Result<Python, String> {
    if let Ok(raw) = std::env::var("PYTHON_PATH") {
        let path = PathBuf::from(raw.trim());
        return python_from_path(path.clone(), Vec::new()).ok_or_else(|| {
            format!("PYTHON_PATH non è un Python valido: {}", path.display())
        });
    }

    let managed = managed_python(app);
    if let Some(py) = managed.as_ref() {
        if packages_ok(py) {
            return Ok(managed.unwrap());
        }
    }

    if let Some(parent) = worker.parent() {
        if let Some(venv) = python_in_venv(&parent.join(".venv")) {
            if let Some(python) = python_from_path(venv, Vec::new()) {
                if packages_ok(&python) {
                    return Ok(python);
                }
            }
        }
    }

    if let Some(py) = managed {
        return Ok(py);
    }

    if let Some(parent) = worker.parent() {
        if let Some(venv) = python_in_venv(&parent.join(".venv")) {
            if let Some(python) = python_from_path(venv, Vec::new()) {
                return Ok(python);
            }
        }
    }

    Err("Ambiente Python non pronto. Attendi la configurazione iniziale.".into())
}
