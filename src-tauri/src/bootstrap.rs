use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::AppHandle;

use crate::prepare;
use crate::python;

const UV_VERSION: &str = "0.12.5";
const PYTHON_VERSION: &str = "3.12";

fn uv_asset() -> Result<(&'static str, &'static str), String> {
    if cfg!(all(windows, target_arch = "x86_64")) {
        Ok(("uv-x86_64-pc-windows-msvc.zip", "zip"))
    } else if cfg!(all(windows, target_arch = "aarch64")) {
        Ok(("uv-aarch64-pc-windows-msvc.zip", "zip"))
    } else if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        Ok(("uv-aarch64-apple-darwin.tar.gz", "tar.gz"))
    } else if cfg!(all(target_os = "macos", target_arch = "x86_64")) {
        Ok(("uv-x86_64-apple-darwin.tar.gz", "tar.gz"))
    } else {
        Err("Piattaforma non supportata per il runtime Python.".into())
    }
}

fn uv_binary_name() -> &'static str {
    if cfg!(windows) {
        "uv.exe"
    } else {
        "uv"
    }
}

fn emit(app: &AppHandle, part: &str, message: &str, percent: f32) {
    prepare::emit_progress(
        app,
        prepare::PrepareProgress {
            status: "downloading".into(),
            part: part.into(),
            message: message.into(),
            percent: Some(percent),
        },
    );
}

fn find_named(root: &Path, name: &str, depth: u32) -> Option<PathBuf> {
    if depth > 4 {
        return None;
    }
    let entries = fs::read_dir(root).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() && path.file_name().is_some_and(|file| file == name) {
            return Some(path);
        }
        if path.is_dir() {
            if let Some(found) = find_named(&path, name, depth + 1) {
                return Some(found);
            }
        }
    }
    None
}

fn command(program: &Path) -> Command {
    let mut cmd = Command::new(program);
    python::with_no_window(&mut cmd);
    cmd
}

fn curl_bin() -> PathBuf {
    if cfg!(windows) {
        PathBuf::from("curl.exe")
    } else {
        PathBuf::from("curl")
    }
}

fn tar_bin() -> PathBuf {
    if cfg!(windows) {
        PathBuf::from("tar.exe")
    } else {
        PathBuf::from("tar")
    }
}

fn download_file(app: &AppHandle, url: &str, dest: &Path, from: f32, cap: f32) -> Result<(), String> {
    let pulse = prepare::Pulse::start(app, "runtime", "Download in corso…", from, cap);
    let result = download_file_inner(url, dest);
    pulse.stop();
    result
}

fn download_file_inner(url: &str, dest: &Path) -> Result<(), String> {
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let mut cmd = command(&curl_bin());
    cmd.args([
        "-L",
        "--fail",
        "--retry",
        "3",
        "-o",
        &dest.display().to_string(),
        url,
    ]);
    let status = cmd
        .status()
        .map_err(|err| format!("Download non riuscito (curl): {err}"))?;
    if status.success() && dest.is_file() {
        return Ok(());
    }

    #[cfg(windows)]
    {
        let mut ps = command(&PathBuf::from("powershell.exe"));
        ps.args([
            "-NoProfile",
            "-NonInteractive",
            "-WindowStyle",
            "Hidden",
            "-Command",
            &format!(
                "Invoke-WebRequest -Uri '{}' -OutFile '{}' -UseBasicParsing",
                url,
                dest.display()
            ),
        ]);
        let ok = ps.status().map(|s| s.success()).unwrap_or(false);
        if ok && dest.is_file() {
            return Ok(());
        }
    }

    Err(format!("Impossibile scaricare {url}"))
}

fn extract_archive(archive: &Path, dest: &Path, kind: &str) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|err| err.to_string())?;
    let mut cmd = command(&tar_bin());
    if kind == "zip" {
        cmd.args([
            "-xf",
            &archive.display().to_string(),
            "-C",
            &dest.display().to_string(),
        ]);
    } else {
        cmd.args([
            "-xzf",
            &archive.display().to_string(),
            "-C",
            &dest.display().to_string(),
        ]);
    }
    let status = cmd
        .status()
        .map_err(|err| format!("Estrazione archivio non riuscita: {err}"))?;
    if status.success() {
        Ok(())
    } else {
        Err("Estrazione di uv non riuscita.".into())
    }
}

fn mark_executable(path: &Path) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = fs::metadata(path) {
            let mut perms = meta.permissions();
            perms.set_mode(0o755);
            let _ = fs::set_permissions(path, perms);
        }
    }
}

fn uv_ok(uv: &Path) -> bool {
    let mut cmd = command(uv);
    cmd.args(["--version"])
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    cmd.status().map(|s| s.success()).unwrap_or(false)
}

fn ensure_uv(app: &AppHandle, root: &Path) -> Result<PathBuf, String> {
    let uv = root.join(uv_binary_name());
    if uv.is_file() && uv_ok(&uv) {
        return Ok(uv);
    }

    emit(app, "runtime", "Download strumento Python", 6.0);
    let (asset, kind) = uv_asset()?;
    let url = format!("https://github.com/astral-sh/uv/releases/download/{UV_VERSION}/{asset}");
    let archive = root.join(asset);
    let unpack = root.join("uv-unpack");
    let _ = fs::remove_dir_all(&unpack);
    download_file(app, &url, &archive, 6.5, 9.5)?;
    emit(app, "runtime", "Installazione strumento Python", 10.0);
    extract_archive(&archive, &unpack, kind)?;
    let found = find_named(&unpack, uv_binary_name(), 0)
        .ok_or_else(|| "uv non trovato nell’archivio scaricato.".to_string())?;
    if found != uv {
        fs::copy(&found, &uv).map_err(|err| format!("Copia di uv non riuscita: {err}"))?;
    }
    mark_executable(&uv);
    let _ = fs::remove_file(&archive);
    let _ = fs::remove_dir_all(&unpack);
    if uv_ok(&uv) {
        Ok(uv)
    } else {
        Err("uv scaricato ma non eseguibile.".into())
    }
}

fn uv_env(root: &Path) -> Vec<(String, String)> {
    vec![
        (
            "UV_PYTHON_INSTALL_DIR".into(),
            root.join("python").display().to_string(),
        ),
        (
            "UV_CACHE_DIR".into(),
            root.join("cache").display().to_string(),
        ),
        ("UV_TOOL_DIR".into(), root.join("tools").display().to_string()),
    ]
}

fn run_uv(
    app: &AppHandle,
    uv: &Path,
    root: &Path,
    args: &[&str],
    message: &str,
    percent: f32,
) -> Result<(), String> {
    emit(app, "runtime", message, percent);
    let pulse = prepare::Pulse::start(
        app,
        "runtime",
        &format!("{message}…"),
        percent,
        (percent + 5.5).min(23.0),
    );
    let mut cmd = command(uv);
    cmd.args(args)
        .current_dir(root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    for (key, value) in uv_env(root) {
        cmd.env(key, value);
    }

    let mut child = match cmd.spawn() {
        Ok(child) => child,
        Err(err) => {
            pulse.stop();
            return Err(format!("Impossibile avviare uv: {err}"));
        }
    };
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let out_thread = stdout.map(|pipe| {
        std::thread::spawn(move || {
            let mut text = String::new();
            for line in BufReader::new(pipe).lines().flatten() {
                if !line.trim().is_empty() {
                    text = line;
                }
            }
            text
        })
    });
    let err_thread = stderr.map(|pipe| {
        std::thread::spawn(move || {
            let mut last = String::new();
            for line in BufReader::new(pipe).lines().flatten() {
                let trim = line.trim();
                if !trim.is_empty() {
                    last = trim.to_string();
                }
            }
            last
        })
    });

    let status = child
        .wait()
        .map_err(|err| format!("uv interrotto: {err}"))?;
    pulse.stop();
    let stdout_text = out_thread.and_then(|t| t.join().ok()).unwrap_or_default();
    let stderr_text = err_thread.and_then(|t| t.join().ok()).unwrap_or_default();
    if status.success() {
        Ok(())
    } else {
        let tail = if !stderr_text.is_empty() {
            stderr_text
        } else {
            stdout_text
        };
        Err(format!("{message} non riuscita. {tail}"))
    }
}

fn run_uv_install(
    app: &AppHandle,
    uv: &Path,
    root: &Path,
    args: &[&str],
    start: f32,
    end: f32,
) -> Result<(), String> {
    emit(app, "packages", "Installazione motori di trascrizione e traduzione", start);
    let pulse = prepare::Pulse::start(
        app,
        "packages",
        "Installazione motori in corso…",
        start,
        (end - 1.5).max(start + 1.0),
    );
    let mut cmd = command(uv);
    cmd.args(args)
        .current_dir(root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    for (key, value) in uv_env(root) {
        cmd.env(key, value);
    }

    let mut child = match cmd
        .spawn()
        .map_err(|err| format!("Impossibile avviare l’installazione pacchetti: {err}"))
    {
        Ok(child) => child,
        Err(err) => {
            pulse.stop();
            return Err(err);
        }
    };
    let stderr = child.stderr.take();
    let stdout = child.stdout.take();
    let mut seen = 0u32;
    let mut last = String::new();

    let mut pump = |line: String| {
        let trim = line.trim();
        if trim.is_empty() {
            return;
        }
        last = trim.to_string();
        seen += 1;
        let t = (seen as f32 / (seen as f32 + 8.0)).min(1.0);
        let pct = start + (end - start) * t;
        let short = if trim.chars().count() > 90 {
            format!("{}…", trim.chars().take(90).collect::<String>())
        } else {
            trim.to_string()
        };
        emit(app, "packages", &short, pct);
    };

    if let Some(pipe) = stderr {
        for line in BufReader::new(pipe).lines().flatten() {
            pump(line);
        }
    }
    if let Some(pipe) = stdout {
        for line in BufReader::new(pipe).lines().flatten() {
            pump(line);
        }
    }

    let status = child
        .wait()
        .map_err(|err| format!("Installazione pacchetti interrotta: {err}"))?;
    pulse.stop();
    if status.success() {
        emit(app, "packages", "Motori Python installati", end);
        Ok(())
    } else {
        Err(format!("Installazione pacchetti non riuscita. {last}"))
    }
}

pub fn runtime_ready(app: &AppHandle) -> bool {
    if let Ok(worker) = python::resolve_script(app, "transcribe.py") {
        if let Ok(py) = python::resolve_python(app, &worker) {
            return python::packages_ok(&py);
        }
    }
    python::managed_python(app)
        .map(|py| python::packages_ok(&py))
        .unwrap_or(false)
}

pub fn ensure_runtime(app: &AppHandle) -> Result<(), String> {
    if runtime_ready(app) {
        return Ok(());
    }

    emit(app, "runtime", "Preparazione ambiente Python", 3.0);
    let root = python::runtime_dir(app)?;
    fs::create_dir_all(&root).map_err(|err| format!("Impossibile creare la cartella runtime: {err}"))?;
    let venv = python::venv_dir(app)?;
    let requirements = python::resolve_script(app, "requirements.txt")?;
    let uv = ensure_uv(app, &root)?;

    let venv_python = python::python_in_venv(&venv).and_then(|path| {
        let py = python::Python {
            program: path,
            prefix: Vec::new(),
        };
        python::python_ok(&py, "import sys").then_some(py)
    });

    if venv_python.is_none() {
        if let Some(system) = python::system_python().and_then(|py| python::executable_path(&py)) {
            let spec = system.display().to_string();
            run_uv(
                app,
                &uv,
                &root,
                &[
                    "venv",
                    &venv.display().to_string(),
                    "--python",
                    &spec,
                    "--clear",
                ],
                "Creazione ambiente Python",
                16.0,
            )?;
        } else {
            run_uv(
                app,
                &uv,
                &root,
                &["python", "install", PYTHON_VERSION],
                "Download Python",
                14.0,
            )?;
            run_uv(
                app,
                &uv,
                &root,
                &[
                    "venv",
                    &venv.display().to_string(),
                    "--python",
                    PYTHON_VERSION,
                    "--clear",
                ],
                "Creazione ambiente Python",
                20.0,
            )?;
        }
    }

    let py = python::managed_python(app)
        .ok_or_else(|| "Ambiente Python creato ma non trovato.".to_string())?;
    if !python::packages_ok(&py) {
        let python_path = py.program.display().to_string();
        let req = requirements.display().to_string();
        run_uv_install(
            app,
            &uv,
            &root,
            &[
                "pip",
                "install",
                "--python",
                &python_path,
                "-r",
                &req,
            ],
            24.0,
            48.0,
        )?;
    }

    if python::packages_ok(&py) || python::managed_python(app).is_some_and(|p| python::packages_ok(&p))
    {
        emit(app, "packages", "Ambiente Python pronto", 50.0);
        Ok(())
    } else {
        Err("I pacchetti Python non risultano installati dopo il setup.".into())
    }
}
