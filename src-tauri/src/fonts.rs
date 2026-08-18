use serde::Serialize;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FontItem {
    pub family: String,
    pub path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FontList {
    pub fonts: Vec<FontItem>,
}

fn be_u16(data: &[u8], off: usize) -> Option<u16> {
    let bytes: [u8; 2] = data.get(off..off + 2)?.try_into().ok()?;
    Some(u16::from_be_bytes(bytes))
}

fn be_u32(data: &[u8], off: usize) -> Option<u32> {
    let bytes: [u8; 4] = data.get(off..off + 4)?.try_into().ok()?;
    Some(u32::from_be_bytes(bytes))
}

fn decode_name(platform: u16, encoding: u16, bytes: &[u8]) -> Option<String> {
    if platform == 3 && (encoding == 1 || encoding == 10) || platform == 0 {
        if bytes.len() < 2 || bytes.len() % 2 != 0 {
            return None;
        }
        let units: Vec<u16> = bytes
            .chunks_exact(2)
            .map(|pair| u16::from_be_bytes([pair[0], pair[1]]))
            .collect();
        let text = String::from_utf16(&units).ok()?.trim().to_string();
        if text.is_empty() {
            None
        } else {
            Some(text)
        }
    } else {
        let text = String::from_utf8_lossy(bytes).trim().to_string();
        if text.is_empty() {
            None
        } else {
            Some(text)
        }
    }
}

fn family_from_name_table(data: &[u8], table_off: usize) -> Option<String> {
    let count = be_u16(data, table_off + 2)? as usize;
    let string_off = table_off + be_u16(data, table_off + 4)? as usize;
    let mut best: Option<(u8, String)> = None;
    for index in 0..count {
        let rec = table_off + 6 + index * 12;
        let platform = be_u16(data, rec)?;
        let encoding = be_u16(data, rec + 2)?;
        let name_id = be_u16(data, rec + 6)?;
        if name_id != 1 && name_id != 16 {
            continue;
        }
        let length = be_u16(data, rec + 8)? as usize;
        let offset = be_u16(data, rec + 10)? as usize;
        let raw = data.get(string_off + offset..string_off + offset + length)?;
        let Some(text) = decode_name(platform, encoding, raw) else {
            continue;
        };
        let rank = match (name_id, platform, encoding) {
            (16, 3, _) => 0,
            (16, 0, _) => 1,
            (1, 3, _) => 2,
            (1, 0, _) => 3,
            _ => 4,
        };
        if best.as_ref().map(|(current, _)| rank < *current).unwrap_or(true) {
            best = Some((rank, text));
        }
    }
    best.map(|(_, name)| name)
}

fn family_from_sfnt(data: &[u8], start: usize) -> Option<String> {
    let num_tables = be_u16(data, start + 4)? as usize;
    for index in 0..num_tables {
        let rec = start + 12 + index * 16;
        let tag = data.get(rec..rec + 4)?;
        if tag != b"name" {
            continue;
        }
        let offset = start + be_u32(data, rec + 8)? as usize;
        return family_from_name_table(data, offset);
    }
    None
}

fn family_from_bytes(data: &[u8]) -> Option<String> {
    if data.len() < 12 {
        return None;
    }
    if data.starts_with(b"ttcf") {
        let count = be_u32(data, 8)? as usize;
        let first = be_u32(data, 12)? as usize;
        if count == 0 {
            return None;
        }
        return family_from_sfnt(data, first);
    }
    family_from_sfnt(data, 0)
}

pub fn family_from_path(path: &Path) -> Option<String> {
    let data = fs::read(path).ok()?;
    family_from_bytes(&data)
}

fn font_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if cfg!(windows) {
        dirs.push(PathBuf::from(r"C:\Windows\Fonts"));
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            dirs.push(PathBuf::from(local).join(r"Microsoft\Windows\Fonts"));
        }
    } else {
        dirs.push(PathBuf::from("/System/Library/Fonts"));
        dirs.push(PathBuf::from("/Library/Fonts"));
        if let Ok(home) = std::env::var("HOME") {
            dirs.push(PathBuf::from(home).join("Library/Fonts"));
        }
    }
    dirs
}

fn is_font_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            matches!(
                ext.to_ascii_lowercase().as_str(),
                "ttf" | "otf" | "ttc" | "otc"
            )
        })
        .unwrap_or(false)
}

pub fn list_fonts() -> FontList {
    let mut by_family: BTreeMap<String, FontItem> = BTreeMap::new();
    for dir in font_dirs() {
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() || !is_font_file(&path) {
                continue;
            }
            let Some(family) = family_from_path(&path) else {
                continue;
            };
            if family.starts_with('.') {
                continue;
            }
            let key = family.to_ascii_lowercase();
            by_family.entry(key).or_insert(FontItem {
                family,
                path: path.display().to_string(),
            });
        }
    }
    let mut fonts: Vec<FontItem> = by_family.into_values().collect();
    fonts.sort_by(|a, b| a.family.to_ascii_lowercase().cmp(&b.family.to_ascii_lowercase()));
    FontList { fonts }
}

pub fn inspect_font(path: String) -> Result<FontItem, String> {
    let file = PathBuf::from(path.trim());
    if !file.is_file() {
        return Err("File font non trovato.".into());
    }
    if !is_font_file(&file) {
        return Err("Usa un file .ttf, .otf o .ttc.".into());
    }
    let family = family_from_path(&file).ok_or_else(|| "Impossibile leggere il nome del font.".to_string())?;
    Ok(FontItem {
        family,
        path: file.display().to_string(),
    })
}
