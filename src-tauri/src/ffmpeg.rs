use serde::Serialize;
use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const MISSING_FFMPEG: &str = "FFmpeg non è installato o non è nel PATH. Installalo, riapri l’app, oppure imposta la variabile FFMPEG_PATH con il percorso di ffmpeg.exe.";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractProgress {
    pub video_path: String,
    pub audio_path: Option<String>,
    pub status: &'static str,
    pub message: String,
    pub percent: Option<f32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractItem {
    pub video_path: String,
    pub audio_path: Option<String>,
    pub duration_secs: Option<f64>,
    pub error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractBatchResult {
    pub ffmpeg_path: String,
    pub items: Vec<ExtractItem>,
}

fn ffmpeg_command(bin: &Path) -> Command {
    let mut cmd = Command::new(bin);
    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

fn looks_like_ffmpeg(bin: &Path) -> bool {
    ffmpeg_command(bin)
        .arg("-version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn sidecar_candidates(exe_dir: &Path) -> Vec<PathBuf> {
    let names = ["ffmpeg.exe", "ffmpeg"];
    let mut out = Vec::new();
    for name in names {
        out.push(exe_dir.join(name));
        out.push(exe_dir.join("ffmpeg").join(name));
    }
    out
}

pub fn resolve_ffmpeg() -> Result<PathBuf, String> {
    if let Ok(raw) = std::env::var("FFMPEG_PATH") {
        let path = PathBuf::from(raw.trim());
        if path.is_file() && looks_like_ffmpeg(&path) {
            return Ok(path);
        }
        return Err(format!(
            "FFMPEG_PATH non punta a un FFmpeg valido: {}",
            path.display()
        ));
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            for candidate in sidecar_candidates(dir) {
                if candidate.is_file() && looks_like_ffmpeg(&candidate) {
                    return Ok(candidate);
                }
            }
        }
    }

    let on_path = PathBuf::from(if cfg!(windows) {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    });
    if looks_like_ffmpeg(&on_path) {
        return Ok(on_path);
    }

    Err(MISSING_FFMPEG.into())
}

fn parse_hms(token: &str) -> Option<f64> {
    let token = token.trim();
    if token.is_empty() || token.eq_ignore_ascii_case("n/a") {
        return None;
    }
    let mut parts = token.split(':');
    let hours: f64 = parts.next()?.parse().ok()?;
    let minutes: f64 = parts.next()?.parse().ok()?;
    let seconds: f64 = parts.next()?.parse().ok()?;
    Some(hours * 3600.0 + minutes * 60.0 + seconds)
}

fn parse_duration(stderr: &str) -> Option<f64> {
    let marker = "Duration: ";
    let start = stderr.find(marker)? + marker.len();
    let rest = stderr.get(start..)?;
    let token = rest.split(',').next()?;
    parse_hms(token)
}

fn probe_duration(ffmpeg: &Path, video: &Path) -> Option<f64> {
    let output = ffmpeg_command(ffmpeg)
        .args(["-hide_banner", "-i"])
        .arg(video)
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .output()
        .ok()?;
    parse_duration(&String::from_utf8_lossy(&output.stderr))
}

fn safe_stem(path: &Path) -> String {
    let raw = path
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("audio");
    let cleaned: String = raw
        .chars()
        .map(|ch| match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => ch,
        })
        .collect();
    if cleaned.trim().is_empty() {
        "audio".into()
    } else {
        cleaned
    }
}

fn wav_name(video: &Path, used: &mut Vec<String>) -> String {
    let stem = safe_stem(video);
    let mut name = format!("{stem}.wav");
    let mut n = 2;
    while used.iter().any(|existing| existing.eq_ignore_ascii_case(&name)) {
        name = format!("{stem}-{n}.wav");
        n += 1;
    }
    used.push(name.clone());
    name
}

fn friendly_error(stderr: &str) -> String {
    let lower = stderr.to_lowercase();
    if lower.contains("does not contain any stream")
        || lower.contains("stream map '0:a")
        || lower.contains("matches no streams")
    {
        return "Questo video non ha una traccia audio.".into();
    }
    if lower.contains("no such file") || lower.contains("failed to open") {
        return "File video illeggibile o non trovato.".into();
    }
    let tail: String = stderr
        .chars()
        .rev()
        .take(800)
        .collect::<String>()
        .chars()
        .rev()
        .collect();
    let tail = tail.trim();
    if tail.is_empty() {
        "FFmpeg non è riuscito a estrarre l’audio.".into()
    } else {
        format!("FFmpeg: {tail}")
    }
}

fn emit_progress(app: &AppHandle, payload: ExtractProgress) {
    let _ = app.emit("extract-progress", payload);
}

fn wav_is_reusable(video: &Path, audio: &Path) -> bool {
    let Ok(audio_meta) = fs::metadata(audio) else {
        return false;
    };
    if !audio_meta.is_file() || audio_meta.len() < 64 {
        return false;
    }
    let Ok(video_meta) = fs::metadata(video) else {
        return false;
    };
    match (audio_meta.modified(), video_meta.modified()) {
        (Ok(audio_time), Ok(video_time)) => audio_time >= video_time,
        _ => true,
    }
}

fn extract_one(
    app: &AppHandle,
    ffmpeg: &Path,
    video: &Path,
    audio: &Path,
) -> Result<f64, String> {
    let video_path = video.display().to_string();
    let audio_path = audio.display().to_string();
    let duration = probe_duration(ffmpeg, video);
    if wav_is_reusable(video, audio) {
        emit_progress(
            app,
            ExtractProgress {
                video_path: video_path.clone(),
                audio_path: Some(audio_path.clone()),
                status: "done",
                message: "Audio già presente".into(),
                percent: Some(100.0),
            },
        );
        return Ok(duration.unwrap_or(0.0));
    }

    emit_progress(
        app,
        ExtractProgress {
            video_path: video_path.clone(),
            audio_path: Some(audio_path.clone()),
            status: "extracting",
            message: "Estrazione audio".into(),
            percent: Some(0.0),
        },
    );

    let mut child = ffmpeg_command(ffmpeg)
        .args([
            "-hide_banner",
            "-nostdin",
            "-nostats",
            "-y",
            "-i",
        ])
        .arg(video)
        .args([
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            "-progress",
            "pipe:1",
        ])
        .arg(audio)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| MISSING_FFMPEG.to_string())?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Impossibile leggere l’avanzamento di FFmpeg.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Impossibile leggere gli errori di FFmpeg.".to_string())?;

    let stderr_thread = std::thread::spawn(move || {
        let mut text = String::new();
        let _ = BufReader::new(stderr).read_to_string(&mut text);
        text
    });

    for line in BufReader::new(stdout).lines().flatten() {
        if let Some(value) = line.strip_prefix("out_time=") {
            if let Some(elapsed) = parse_hms(value) {
                let percent = duration
                    .filter(|total| *total > 0.0)
                    .map(|total| ((elapsed / total) * 100.0).clamp(0.0, 99.0) as f32);
                emit_progress(
                    app,
                    ExtractProgress {
                        video_path: video_path.clone(),
                        audio_path: Some(audio_path.clone()),
                        status: "extracting",
                        message: "Estrazione audio".into(),
                        percent,
                    },
                );
            }
        }
    }

    let status = child
        .wait()
        .map_err(|err| format!("FFmpeg si è interrotto: {err}"))?;
    let stderr_text = stderr_thread.join().unwrap_or_default();

    if !status.success() {
        return Err(friendly_error(&stderr_text));
    }

    let meta = fs::metadata(audio).map_err(|_| {
        "FFmpeg ha finito ma il file audio non è stato creato.".to_string()
    })?;
    if meta.len() < 64 {
        return Err("Il file audio è vuoto. Controlla che il video abbia una traccia audio.".into());
    }

    emit_progress(
        app,
        ExtractProgress {
            video_path,
            audio_path: Some(audio_path),
            status: "done",
            message: "Audio pronto".into(),
            percent: Some(100.0),
        },
    );

    Ok(duration.unwrap_or(0.0))
}

pub fn extract_audio_batch(
    app: &AppHandle,
    video_paths: &[String],
    output_dir: &str,
) -> Result<ExtractBatchResult, String> {
    if video_paths.is_empty() {
        return Err("Aggiungi almeno un video dell’intervista.".into());
    }

    let output_dir = output_dir.trim();
    if output_dir.is_empty() {
        return Err("Scegli la cartella dove salvare i file.".into());
    }

    let output_path = PathBuf::from(output_dir);
    fs::create_dir_all(&output_path).map_err(|_| {
        format!("Impossibile creare o usare la cartella di output: {output_dir}")
    })?;

    let ffmpeg = resolve_ffmpeg()?;
    let mut used_names = Vec::new();
    let mut items = Vec::new();

    for raw in video_paths {
        let video = PathBuf::from(raw);
        let video_path = video.display().to_string();

        if !video.is_file() {
            let message = "File video illeggibile o non trovato.".to_string();
            emit_progress(
                app,
                ExtractProgress {
                    video_path: video_path.clone(),
                    audio_path: None,
                    status: "error",
                    message: message.clone(),
                    percent: None,
                },
            );
            items.push(ExtractItem {
                video_path,
                audio_path: None,
                duration_secs: None,
                error: Some(message),
            });
            continue;
        }

        let audio = output_path.join(wav_name(&video, &mut used_names));
        match extract_one(app, &ffmpeg, &video, &audio) {
            Ok(duration_secs) => items.push(ExtractItem {
                video_path,
                audio_path: Some(audio.display().to_string()),
                duration_secs: Some(duration_secs),
                error: None,
            }),
            Err(message) => {
                emit_progress(
                    app,
                    ExtractProgress {
                        video_path: video_path.clone(),
                        audio_path: None,
                        status: "error",
                        message: message.clone(),
                        percent: None,
                    },
                );
                let _ = fs::remove_file(&audio);
                items.push(ExtractItem {
                    video_path,
                    audio_path: None,
                    duration_secs: None,
                    error: Some(message),
                });
            }
        }
    }

    Ok(ExtractBatchResult {
        ffmpeg_path: ffmpeg.display().to_string(),
        items,
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoPreview {
    pub video_path: String,
    pub frames: Vec<String>,
    pub duration_secs: Option<f64>,
}

fn base64_encode(data: &[u8]) -> String {
    const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    let mut index = 0;
    while index < data.len() {
        let b0 = data[index];
        let b1 = if index + 1 < data.len() { data[index + 1] } else { 0 };
        let b2 = if index + 2 < data.len() { data[index + 2] } else { 0 };
        let triple = (u32::from(b0) << 16) | (u32::from(b1) << 8) | u32::from(b2);
        out.push(TABLE[((triple >> 18) & 0x3F) as usize] as char);
        out.push(TABLE[((triple >> 12) & 0x3F) as usize] as char);
        if index + 1 < data.len() {
            out.push(TABLE[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
        if index + 2 < data.len() {
            out.push(TABLE[(triple & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
        index += 3;
    }
    out
}

fn grab_frame(ffmpeg: &Path, video: &Path, at: f64) -> Option<String> {
    let at = at.max(0.08);
    let output = ffmpeg_command(ffmpeg)
        .args([
            "-hide_banner",
            "-loglevel",
            "error",
            "-nostdin",
            "-ss",
            &format!("{at:.3}"),
            "-i",
        ])
        .arg(video)
        .args([
            "-an",
            "-frames:v",
            "1",
            "-vf",
            "scale=480:-2",
            "-q:v",
            "5",
            "-f",
            "image2pipe",
            "-vcodec",
            "mjpeg",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    if !output.status.success() || output.stdout.len() < 64 {
        return None;
    }
    Some(format!(
        "data:image/jpeg;base64,{}",
        base64_encode(&output.stdout)
    ))
}

fn preview_times(duration: Option<f64>) -> Vec<f64> {
    match duration.filter(|total| *total > 0.4) {
        Some(total) if total < 4.0 => vec![(total * 0.35).max(0.1)],
        Some(total) => vec![total * 0.12, total * 0.45, total * 0.78]
            .into_iter()
            .map(|at| at.clamp(0.1, (total - 0.12).max(0.1)))
            .collect(),
        None => vec![1.0, 8.0, 20.0],
    }
}

pub fn preview_videos(paths: &[String]) -> Vec<VideoPreview> {
    let ffmpeg = resolve_ffmpeg().ok();
    let mut items = Vec::new();
    for raw in paths {
        let video = PathBuf::from(raw);
        let video_path = video.display().to_string();
        let Some(bin) = ffmpeg.as_ref() else {
            items.push(VideoPreview {
                video_path,
                frames: Vec::new(),
                duration_secs: None,
            });
            continue;
        };
        if !video.is_file() {
            items.push(VideoPreview {
                video_path,
                frames: Vec::new(),
                duration_secs: None,
            });
            continue;
        }
        let duration_secs = probe_duration(bin, &video);
        let mut frames = Vec::new();
        for at in preview_times(duration_secs) {
            if let Some(frame) = grab_frame(bin, &video, at) {
                frames.push(frame);
            }
            if frames.len() >= 3 {
                break;
            }
        }
        items.push(VideoPreview {
            video_path,
            frames,
            duration_secs,
        });
    }
    items
}
