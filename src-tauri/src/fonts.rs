use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

use base64::Engine;
use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use serde_json::{json, Value};
use tauri::AppHandle;

use crate::data::{self, FontFile, FontMeta};
use crate::dialogs;
use crate::state::{self, AppState, MAX_FONT_BYTES};

fn has_font_ext(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.ends_with(".ttf")
        || lower.ends_with(".otf")
        || lower.ends_with(".woff")
        || lower.ends_with(".woff2")
}

fn scan(dir: &Path, prefix: &str, out: &mut Vec<(String, String, String)>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if !has_font_ext(&name) {
            continue;
        }
        out.push((
            name.clone(),
            format!("{prefix}{}", utf8_percent_encode(&name, NON_ALPHANUMERIC)),
            entry.path().to_string_lossy().to_string(),
        ));
    }
}

pub fn list_font_files(state: &AppState) -> Vec<FontFile> {
    let mut files = Vec::new();
    scan(&state.paths.app_fonts, "/fonts/", &mut files);
    scan(&state.paths.fonts, "/user-fonts/", &mut files);
    files
        .into_iter()
        .map(|(name, url, path)| {
            let meta = font_meta(state, &path);
            FontFile {
                name,
                url,
                path,
                family: meta.family,
                bold: meta.bold,
                italic: meta.italic,
            }
        })
        .collect()
}

pub fn font_meta(state: &AppState, path: &str) -> FontMeta {
    let stamp = fs::metadata(path)
        .ok()
        .map(|m| format!("{}:{}", m.len(), state::mtime_ms(&m)))
        .unwrap_or_default();
    let key = format!("{path}|{stamp}");
    if let Some(hit) = state
        .font_meta_cache
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .get(&key)
        .cloned()
    {
        return hit;
    }
    let meta = fs::read(path)
        .ok()
        .and_then(|buf| data::read_font_meta(&buf))
        .unwrap_or_default();
    state
        .font_meta_cache
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .insert(key, meta.clone());
    meta
}

pub fn font_families(state: &AppState) -> Vec<String> {
    let mut set = BTreeSet::new();
    for file in list_font_files(state) {
        set.insert(data::font_family_of(&file.name, file.family.as_deref()));
    }
    let mut list: Vec<String> = set.into_iter().collect();
    list.sort_by_key(|s| s.to_lowercase());
    list
}

pub fn build_css(state: &AppState) -> String {
    data::build_font_css(&list_font_files(state))
}

pub fn add_font_files(app: &AppHandle, state: &AppState) -> Value {
    let files = dialogs::pick_files(
        app,
        "Tambah file font (.ttf / .otf / .woff / .woff2)",
        &[("File font", &["ttf", "otf", "woff", "woff2"])],
    );
    if files.is_empty() {
        return json!({ "ok": false, "canceled": true });
    }
    let mut added = Vec::new();
    for src in files {
        let Some(name) = src.file_name().and_then(|s| s.to_str()) else {
            continue;
        };
        let safe: String = name
            .chars()
            .map(|ch| {
                if ch.is_alphanumeric() || matches!(ch, '_' | '.' | '-' | '[' | ']' | '(' | ')' | ' ') {
                    ch
                } else {
                    '_'
                }
            })
            .collect();
        let dest = state.paths.fonts.join(&safe);
        if fs::copy(&src, &dest).is_err() {
            continue;
        }
        let family = {
            let meta = font_meta(state, &dest.to_string_lossy());
            data::font_family_of(&safe, meta.family.as_deref())
        };
        added.push(family);
    }
    added.sort();
    added.dedup();
    if added.is_empty() {
        json!({ "ok": false, "error": "Tidak ada font yang dapat disalin." })
    } else {
        json!({ "ok": true, "added": added })
    }
}

pub fn fonts_for_project(state: &AppState, obj: &Value) -> Vec<Value> {
    let hay = serde_json::to_string(&json!([
        obj.get("settings").cloned().unwrap_or(Value::Null),
        obj.get("dev").cloned().unwrap_or(Value::Null)
    ]))
    .unwrap_or_default()
    .to_lowercase();

    let mut out = Vec::new();
    let Ok(entries) = fs::read_dir(&state.paths.fonts) else {
        return out;
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if !has_font_ext(&name) {
            continue;
        }
        let path = entry.path();
        let Ok(meta) = fs::metadata(&path) else {
            continue;
        };
        if !meta.is_file() || meta.len() > MAX_FONT_BYTES {
            continue;
        }
        let Ok(buf) = fs::read(&path) else {
            continue;
        };
        let family = {
            let fm = font_meta(state, &path.to_string_lossy());
            data::font_family_of(&name, fm.family.as_deref())
        };
        if !hay.contains(&family.to_lowercase()) {
            continue;
        }
        out.push(json!({
            "name": name,
            "family": family,
            "sha1": state::sha1_hex(&buf),
            "data": base64::engine::general_purpose::STANDARD.encode(&buf),
        }));
    }
    out
}

pub fn restore_fonts(state: &AppState, fonts: &[Value]) -> usize {
    let mut restored = 0usize;
    for font in fonts {
        let Some(name) = font.get("name").and_then(Value::as_str) else {
            continue;
        };
        let Some(encoded) = font.get("data").and_then(Value::as_str) else {
            continue;
        };
        let safe: String = Path::new(name)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .chars()
            .map(|ch| {
                if ch.is_alphanumeric() || matches!(ch, '_' | '.' | '-' | '[' | ']' | '(' | ')' | ' ') {
                    ch
                } else {
                    '_'
                }
            })
            .collect();
        if !has_font_ext(&safe) {
            continue;
        }
        let Ok(buf) = base64::engine::general_purpose::STANDARD.decode(encoded) else {
            continue;
        };
        if buf.is_empty() || buf.len() as u64 > MAX_FONT_BYTES {
            continue;
        }
        if let Some(expected) = font.get("sha1").and_then(Value::as_str) {
            if state::sha1_hex(&buf) != expected {
                continue;
            }
        }
        let dest = state.paths.fonts.join(&safe);
        if dest.exists() {
            continue;
        }
        if fs::write(dest, buf).is_ok() {
            restored += 1;
        }
    }
    restored
}
