use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tauri::{AppHandle, Emitter};

use crate::ffmpeg;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BurnJob {
    pub video_path: String,
    pub ass_text: String,
    pub language: Option<String>,
    pub folder_path: Option<String>,
    pub font_dir: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BurnProgress {
    pub video_path: String,
    pub status: String,
    pub message: String,
    pub percent: Option<f32>,
    pub output_path: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BurnItem {
    pub video_path: String,
    pub output_path: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BurnBatchResult {
    pub items: Vec<BurnItem>,
}

fn emit_progress(app: &AppHandle, payload: BurnProgress) {
    let _ = app.emit("burn-progress", payload);
}

fn even(value: u32) -> u32 {
    value & !1
}

fn named_short(kind: &str) -> Option<u32> {
    match kind {
        "1080" => Some(1080),
        "1440" => Some(1440),
        "4k" => Some(2160),
        _ => None,
    }
}

fn frame_aspect(fit: &str, source: (u32, u32)) -> f64 {
    match fit {
        "landscape" => 16.0 / 9.0,
        "portrait" => 9.0 / 16.0,
        "square" => 1.0,
        _ => {
            let w = source.0.max(2) as f64;
            let h = source.1.max(2) as f64;
            w / h
        }
    }
}

fn target_size(resolution: &str, fit: &str, source: (u32, u32)) -> Result<(u32, u32), String> {
    let aspect = frame_aspect(fit, source);
    if aspect <= 0.0 {
        return Err("Risoluzione non valida.".into());
    }
    let (width, height) = if let Some(short) = named_short(resolution) {
        if aspect >= 1.0 {
            (((short as f64 * aspect).round() as u32), short)
        } else {
            (short, ((short as f64 / aspect).round() as u32))
        }
    } else if fit == "source" {
        (source.0, source.1)
    } else {
        let long = source.0.max(source.1).max(2);
        if aspect >= 1.0 {
            (long, ((long as f64 / aspect).round() as u32))
        } else {
            (((long as f64 * aspect).round() as u32), long)
        }
    };
    Ok((even(width).max(2), even(height).max(2)))
}

fn res_tag(kind: &str, fit: &str) -> String {
    let base = match kind {
        "1080" => "1080p",
        "1440" => "1440p",
        "4k" => "2160p",
        _ => "source",
    };
    match fit {
        "landscape" => format!("{base}-16x9"),
        "portrait" => format!("{base}-9x16"),
        "square" => format!("{base}-1x1"),
        _ => base.to_string(),
    }
}

fn ext_for(format: &str) -> Result<&'static str, String> {
    match format {
        "mp4" => Ok("mp4"),
        "mov" => Ok("mov"),
        "webm" => Ok("webm"),
        _ => Err("Formato non supportato.".into()),
    }
}

fn lang_tag(raw: Option<&str>) -> String {
    let cleaned: String = raw
        .unwrap_or("und")
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .map(|ch| ch.to_ascii_lowercase())
        .collect();
    if cleaned.is_empty() {
        "und".into()
    } else {
        cleaned
    }
}

fn filter_path(path: &Path) -> String {
    path.to_string_lossy()
        .replace('\\', "/")
        .replace(':', "\\:")
        .replace('\'', "\\'")
        .replace('[', "\\[")
        .replace(']', "\\]")
}

fn friendly_burn_error(stderr: &str) -> String {
    let lower = stderr.to_lowercase();
    if lower.contains("no such filter: 'subtitles'")
        || lower.contains("no such filter: \"subtitles\"")
        || lower.contains("libass")
    {
        return "Questo FFmpeg non include libass. Serve una build completa (es. Gyan.FFmpeg).".into();
    }
    if lower.contains("unknown encoder") && (lower.contains("libvpx") || lower.contains("vp9")) {
        return "Questo FFmpeg non include VP9 (WebM). Scegli MP4 o MOV.".into();
    }
    if lower.contains("unknown encoder") && lower.contains("libopus") {
        return "Questo FFmpeg non include Opus. Scegli MP4 o MOV.".into();
    }
    let tail = stderr
        .lines()
        .rev()
        .find(|line| !line.trim().is_empty())
        .unwrap_or("FFmpeg non è riuscito a esportare il video.")
        .trim();
    format!("FFmpeg: {tail}")
}

fn encode_args(format: &str) -> Result<Vec<&'static str>, String> {
    match format {
        "mp4" | "mov" => Ok(vec![
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
        ]),
        "webm" => Ok(vec![
            "-c:v",
            "libvpx-vp9",
            "-b:v",
            "0",
            "-crf",
            "32",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "libopus",
            "-b:a",
            "128k",
        ]),
        _ => Err("Formato non supportato.".into()),
    }
}

fn burn_one(
    app: &AppHandle,
    ffmpeg_bin: &Path,
    job: &BurnJob,
    format: &str,
    resolution: &str,
    fit: &str,
    output_dir: &Path,
) -> Result<PathBuf, String> {
    let video = PathBuf::from(&job.video_path);
    if !video.is_file() {
        return Err("Video non trovato.".into());
    }
    let source = ffmpeg::probe_display_size(ffmpeg_bin, &video)?;
    let (width, height) = target_size(resolution, fit, source)?;
    let stem = ffmpeg::safe_stem(&video);
    let folder = job
        .folder_path
        .as_deref()
        .map(PathBuf::from)
        .filter(|path| !path.as_os_str().is_empty())
        .unwrap_or_else(|| output_dir.join(&stem));
    fs::create_dir_all(&folder)
        .map_err(|err| format!("Impossibile creare la cartella di export: {err}"))?;

    let ass_path = std::env::temp_dir().join(format!("video-sub-{stem}.ass"));
    fs::write(&ass_path, &job.ass_text)
        .map_err(|err| format!("Impossibile scrivere i sottotitoli temporanei: {err}"))?;

    let ext = ext_for(format)?;
    let output = folder.join(format!(
        "{stem}.{}.{}.{}",
        lang_tag(job.language.as_deref()),
        res_tag(resolution, fit),
        ext
    ));
    let mut vf = format!(
        "scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,subtitles='{}'",
        filter_path(&ass_path)
    );
    if let Some(font_dir) = job.font_dir.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        vf.push_str(&format!(":fontsdir='{}'", filter_path(&PathBuf::from(font_dir))));
    }
    let duration = ffmpeg::probe_duration(ffmpeg_bin, &video);
    let video_path = job.video_path.clone();

    emit_progress(
        app,
        BurnProgress {
            video_path: video_path.clone(),
            status: "burning".into(),
            message: "Export video".into(),
            percent: Some(0.0),
            output_path: None,
        },
    );

    let mut child = ffmpeg::ffmpeg_command(ffmpeg_bin)
        .args(["-hide_banner", "-nostdin", "-nostats", "-y", "-i"])
        .arg(&video)
        .args(["-map", "0:v:0", "-map", "0:a:0?", "-sn", "-vf", &vf])
        .args(encode_args(format)?)
        .args(["-progress", "pipe:1"])
        .arg(&output)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| ffmpeg::MISSING_FFMPEG.to_string())?;

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
            if let Some(elapsed) = ffmpeg::parse_hms(value) {
                let percent = duration
                    .filter(|total| *total > 0.0)
                    .map(|total| ((elapsed / total) * 100.0).clamp(0.0, 99.0) as f32);
                emit_progress(
                    app,
                    BurnProgress {
                        video_path: video_path.clone(),
                        status: "burning".into(),
                        message: "Export video".into(),
                        percent,
                        output_path: None,
                    },
                );
            }
        }
    }

    let status = child
        .wait()
        .map_err(|err| format!("FFmpeg si è interrotto: {err}"))?;
    let stderr_text = stderr_thread.join().unwrap_or_default();
    let _ = fs::remove_file(&ass_path);

    if !status.success() {
        let _ = fs::remove_file(&output);
        return Err(friendly_burn_error(&stderr_text));
    }
    let meta = fs::metadata(&output).map_err(|_| {
        "FFmpeg ha finito ma il file video non è stato creato.".to_string()
    })?;
    if meta.len() < 64 {
        let _ = fs::remove_file(&output);
        return Err("Il file video è vuoto.".into());
    }

    emit_progress(
        app,
        BurnProgress {
            video_path,
            status: "done".into(),
            message: "Video esportato".into(),
            percent: Some(100.0),
            output_path: Some(output.display().to_string()),
        },
    );

    Ok(output)
}

pub fn burn_batch(
    app: &AppHandle,
    items: &[BurnJob],
    format: &str,
    resolution: &str,
    fit: &str,
    output_dir: &str,
) -> Result<BurnBatchResult, String> {
    if items.is_empty() {
        return Err("Nessun video da esportare.".into());
    }
    let format = format.trim().to_lowercase();
    let resolution = resolution.trim().to_lowercase();
    let fit = match fit.trim().to_lowercase().as_str() {
        "landscape" | "portrait" | "square" => fit.trim().to_lowercase(),
        _ => "source".into(),
    };
    ext_for(&format)?;
    let ffmpeg_bin = ffmpeg::resolve_ffmpeg()?;
    let output_dir = output_dir.trim();
    if output_dir.is_empty() {
        return Err("Scegli la cartella dove salvare i file.".into());
    }
    let output_path = PathBuf::from(output_dir);
    fs::create_dir_all(&output_path).map_err(|_| {
        format!("Impossibile creare o usare la cartella di output: {output_dir}")
    })?;

    let mut results = Vec::new();
    for job in items {
        match burn_one(app, &ffmpeg_bin, job, &format, &resolution, &fit, &output_path) {
            Ok(path) => results.push(BurnItem {
                video_path: job.video_path.clone(),
                output_path: Some(path.display().to_string()),
                error: None,
            }),
            Err(error) => {
                emit_progress(
                    app,
                    BurnProgress {
                        video_path: job.video_path.clone(),
                        status: "error".into(),
                        message: error.clone(),
                        percent: None,
                        output_path: None,
                    },
                );
                results.push(BurnItem {
                    video_path: job.video_path.clone(),
                    output_path: None,
                    error: Some(error),
                });
            }
        }
    }
    Ok(BurnBatchResult { items: results })
}
