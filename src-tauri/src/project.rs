use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

const PROJECT_FILE: &str = "video-sub.json";

fn project_path(folder: &str) -> Result<PathBuf, String> {
    let dir = PathBuf::from(folder.trim());
    if dir.as_os_str().is_empty() {
        return Err("Cartella progetto vuota".into());
    }
    Ok(dir.join(PROJECT_FILE))
}

fn with_folder(mut value: Value, folder: &Path) -> Value {
    if let Some(obj) = value.as_object_mut() {
        obj.insert(
            "folder".into(),
            Value::String(folder.display().to_string()),
        );
    }
    value
}

#[tauri::command(rename_all = "camelCase")]
pub fn read_project(folder: String) -> Result<Option<Value>, String> {
    let path = project_path(&folder)?;
    let dir = path.parent().unwrap_or_else(|| Path::new(&folder));
    if !dir.exists() {
        return Err("Cartella progetto non trovata".into());
    }
    if !path.is_file() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path)
        .map_err(|err| format!("Impossibile leggere il progetto: {err}"))?;
    let parsed: Value = serde_json::from_str(&raw)
        .map_err(|err| format!("Progetto non valido: {err}"))?;
    Ok(Some(with_folder(parsed, dir)))
}

#[tauri::command(rename_all = "camelCase")]
pub fn write_project(folder: String, project: Value) -> Result<(), String> {
    let path = project_path(&folder)?;
    let dir = path
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "Cartella progetto vuota".to_string())?;
    fs::create_dir_all(&dir).map_err(|err| format!("Impossibile creare la cartella: {err}"))?;
    let body = with_folder(project, &dir);
    let raw = serde_json::to_string_pretty(&body)
        .map_err(|err| format!("Impossibile serializzare il progetto: {err}"))?;
    fs::write(&path, raw).map_err(|err| format!("Impossibile salvare il progetto: {err}"))?;
    Ok(())
}
