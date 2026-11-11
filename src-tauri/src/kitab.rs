use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

use serde_json::{json, Value};
use tauri::AppHandle;

use crate::data;
use crate::dialogs;
use crate::project::apply_project;

pub const JENIS_DEFAULT: &str = "Lainnya";
const JENIS_STANDAR: &[&str] =
    &["Fiqih", "Hadis", "Tafsir", "Akidah", "Akhlak", "Tasawuf", "Nahwu", "Sharaf"];

fn has_kitab_ext(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.ends_with(".ngaji") || lower.ends_with(".safinah")
}

fn clean_jenis(v: &str) -> String {
    let t = v
        .trim()
        .chars()
        .map(|c| {
            if matches!(
                c,
                '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\u{0000}'..='\u{001f}'
            ) {
                ' '
            } else {
                c
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    if t == "." || t == ".." {
        String::new()
    } else {
        t.chars().take(40).collect()
    }
}

fn read_jenis_manifest(dir: &Path) -> Value {
    let file = dir.join("jenis.json");
    match fs::read_to_string(&file) {
        Ok(src) => {
            let src = src.trim_start_matches('\u{feff}');
            serde_json::from_str::<Value>(src)
                .ok()
                .filter(|j| j.is_object() && !j.is_array())
                .unwrap_or(Value::Null)
        }
        Err(_) => Value::Null,
    }
}

fn manifest_jenis(manifest: &Value, name: &str) -> Option<String> {
    manifest
        .get(name)
        .and_then(Value::as_object)
        .and_then(|o| o.get("jenis").and_then(Value::as_str))
        .map(|s| clean_jenis(s))
}

fn title_stem(name: &str) -> String {
    name.strip_suffix(".ngaji")
        .or(name.strip_suffix(".safinah"))
        .unwrap_or(name)
        .to_owned()
}

lazy_static::lazy_static! {
    /// Cache ringkasan kitab: path -> (ukuran, mtime ms, ringkasan). Daftar kitab dibuka tiap kali jendela
    /// pilihan tampil; tanpa cache setiap file .ngaji di-parse penuh lagi (lambat bila kitab besar).
    static ref SUMMARY_CACHE: std::sync::Mutex<std::collections::HashMap<std::path::PathBuf, (u64, u128, Value)>> =
        std::sync::Mutex::new(std::collections::HashMap::new());
}

fn read_kitab_summary(file: &Path, name: &str) -> Option<Value> {
    let meta = fs::metadata(file).ok()?;
    let stamp = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let key = (meta.len(), stamp);
    if let Some((len, ts, hit)) = SUMMARY_CACHE
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .get(file)
    {
        if (*len, *ts) == key {
            return Some(hit.clone());
        }
    }

    let src = fs::read_to_string(file).ok()?;
    let raw_json = src.trim_start_matches('\u{feff}');
    // parse SEKALI saja
    let j: Value = serde_json::from_str(raw_json).ok()?;
    let (data, _fonts) = data::parse_project_value(&j).ok()?;
    let file_jenis = j
        .get("jenis")
        .and_then(Value::as_str)
        .map(clean_jenis)
        .unwrap_or_default();
    let mut sentences = 0usize;
    if let Some(pages) = data.get("pages").and_then(Value::as_array) {
        for p in pages {
            if let Some(sents) = p.get("sentences").and_then(Value::as_array) {
                sentences += sents.len();
            }
        }
    }
    let title = title_stem(name);
    let summary = json!({
        "name": name,
        "title": title,
        "pages": data.get("pages").and_then(Value::as_array).map(|a| a.len()).unwrap_or(0),
        "sentences": sentences,
        "_jenis": file_jenis,
    });
    SUMMARY_CACHE
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .insert(file.to_path_buf(), (key.0, key.1, summary.clone()));
    Some(summary)
}

fn scan_kitab_dir(
    src: &str,
    dir: &Path,
    out: &mut Vec<Value>,
    folders: &mut BTreeSet<String>,
    manifest: &Value,
    rel_prefix: &str,
) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        let path = entry.path();
        let is_file = entry.file_type().map(|ft| ft.is_file()).unwrap_or(false);
        let is_dir = entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
        if is_file && has_kitab_ext(&name) {
            let jenis = manifest_jenis(&manifest, &name).unwrap_or_default();
            let rel = if rel_prefix.is_empty() {
                name.clone()
            } else {
                format!("{rel_prefix}/{name}")
            };
            if let Some(mut info) = read_kitab_summary(&path, &name) {
                let final_jenis = if !jenis.is_empty() {
                    jenis
                } else {
                    info.get("_jenis").and_then(Value::as_str).unwrap_or_default().to_owned()
                };
                info.as_object_mut().unwrap().remove("_jenis");
                out.push(json!({
                    "id": format!("{src}:{rel}"),
                    "src": src,
                    "jenis": if final_jenis.is_empty() { JENIS_DEFAULT.to_owned() } else { final_jenis },
                    "name": info.get("name").and_then(Value::as_str)
                        .map(|s| s.to_owned())
                        .unwrap_or_else(|| name.to_owned()),
                    "title": info.get("title").and_then(Value::as_str)
                        .map(|s| s.to_owned())
                        .unwrap_or_else(|| title_stem(&name)),
                    "pages": info.get("pages"),
                    "sentences": info.get("sentences"),
                }));
            }
        } else if is_dir {
            let jenis = clean_jenis(&name);
            if jenis.is_empty() || jenis != name {
                continue;
            }
            folders.insert(jenis.clone());
            let sub_entries = match fs::read_dir(&path) {
                Ok(e) => e,
                Err(_) => continue,
            };
            for f in sub_entries.flatten() {
                let fname = f.file_name().to_string_lossy().to_string();
                let fpath = f.path();
                if f.file_type().map(|ft| ft.is_file()).unwrap_or(false) && has_kitab_ext(&fname) {
                    let rel = format!("{rel_prefix}{name}/{fname}");
                    if let Some(mut info) = read_kitab_summary(&fpath, &fname) {
                        info.as_object_mut().unwrap().remove("_jenis");
                        out.push(json!({
                            "id": format!("{src}:{rel}"),
                            "src": src,
                            "jenis": jenis,
                            "name": info.get("name").and_then(Value::as_str)
                                .map(|s| s.to_owned())
                                .unwrap_or_else(|| fname.to_owned()),
                            "title": info.get("title").and_then(Value::as_str)
                                .map(|s| s.to_owned())
                                .unwrap_or_else(|| title_stem(&fname)),
                            "pages": info.get("pages"),
                            "sentences": info.get("sentences"),
                        }));
                    }
                }
            }
        }
    }
}

pub fn list_kitab(app: &AppHandle, state: &crate::state::AppState) -> Value {
    let mut books: Vec<Value> = Vec::new();
    let mut folders: BTreeSet<String> = BTreeSet::new();
    for j in JENIS_STANDAR {
        folders.insert((*j).to_owned());
    }

    // bundled
    let bundled_dir = crate::state::bundled_kitab_dir(app);
    if bundled_dir.is_dir() {
        let manifest = read_jenis_manifest(&bundled_dir);
        scan_kitab_dir("b", &bundled_dir, &mut books, &mut folders, &manifest, "");
    }

    // user
    let user_dir = &state.paths.user_kitab;
    let _ = fs::create_dir_all(user_dir);
    for j in JENIS_STANDAR {
        let _ = fs::create_dir_all(user_dir.join(j));
    }
    if user_dir.is_dir() {
        let manifest = read_jenis_manifest(user_dir);
        scan_kitab_dir("u", user_dir, &mut books, &mut folders, &manifest, "");
    }

    // dedupe by (jenis, name): user wins since scanned last
    let mut best: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for (i, b) in books.iter().enumerate() {
        let jenis = b
            .get("jenis")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_lowercase();
        let name = b
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_lowercase();
        best.insert(format!("{jenis}/{name}"), i);
    }

    let mut out: Vec<Value> = Vec::new();
    for (i, b) in books.iter().enumerate() {
        let jenis = b
            .get("jenis")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_lowercase();
        let name = b
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_lowercase();
        if best.get(&format!("{jenis}/{name}")) == Some(&i) {
            out.push(b.clone());
        }
    }

    out.sort_by(|a, b| {
        let ta = a.get("title").and_then(Value::as_str).unwrap_or("");
        let tb = b.get("title").and_then(Value::as_str).unwrap_or("");
        ta.to_lowercase().cmp(&tb.to_lowercase())
    });

    for b in &out {
        if let Some(j) = b.get("jenis").and_then(Value::as_str) {
            folders.insert(j.to_owned());
        }
    }
    if !out.iter().any(|b| b.get("jenis").and_then(Value::as_str) == Some(JENIS_DEFAULT)) {
        folders.remove(JENIS_DEFAULT);
    }

    json!({
        "books": out,
        "jenis": folders.into_iter().collect::<Vec<_>>()
    })
}

pub fn open_kitab(app: &AppHandle, state: &crate::state::AppState, id: &str, hold_ms: u64) -> Value {
    crate::perf::begin();
    let now_ms = crate::state::now_ms() as u64;
    let hold_until = now_ms.saturating_add(hold_ms.min(1500));

    let id = id.trim();
    let colon_pos = match id.find(':') {
        Some(p) => p,
        None => return json!({ "ok": false, "error": "Nama kitab tidak valid" }),
    };
    let src = &id[..colon_pos];
    let rel = &id[colon_pos + 1..];
    let path_parts: Vec<&str> = rel.split('/').collect();
    if path_parts.iter().any(|p| p.is_empty() || *p == "." || *p == "..") {
        return json!({ "ok": false, "error": "Nama kitab tidak valid" });
    }
    let name = path_parts.last().copied().unwrap_or("");
    if !has_kitab_ext(name) {
        return json!({ "ok": false, "error": "Nama kitab tidak valid" });
    }
    let root = match src {
        "u" => state.paths.user_kitab.clone(),
        "b" => crate::state::bundled_kitab_dir(app),
        _ => return json!({ "ok": false, "error": "Nama kitab tidak valid" }),
    };
    let mut file = root.clone();
    for p in &path_parts {
        file.push(p);
    }
    if let Ok(rel_path) = file.strip_prefix(&root) {
        if rel_path.starts_with("..") {
            return json!({ "ok": false, "error": "Nama kitab tidak valid" });
        }
    } else {
        return json!({ "ok": false, "error": "Nama kitab tidak valid" });
    };

    let src_text = match fs::read_to_string(&file) {
        Ok(s) => s.trim_start_matches('\u{feff}').to_owned(),
        Err(e) => {
            dialogs::info(
                app,
                "Kitab tidak dapat dibuka.",
                Some(&e.to_string()),
                tauri_plugin_dialog::MessageDialogKind::Error,
            );
            return json!({ "ok": false });
        }
    };
    crate::perf::mark("baca-file");
    let parsed = match data::parse_project(&src_text) {
        Ok(p) => p,
        Err(e) => {
            dialogs::info(
                app,
                "Kitab tidak dapat dibuka.",
                Some(&e),
                tauri_plugin_dialog::MessageDialogKind::Error,
            );
            return json!({ "ok": false });
        }
    };
    crate::perf::mark("parse");

    if !crate::project::confirm_leave_after_flush(app, state) {
        return json!({ "ok": false, "canceled": true });
    }
    crate::perf::mark("cek-perubahan");

    let label = title_stem(name);
    let swap_obj = parsed.0.clone(); // objek data untuk ditukar di tempat oleh renderer
    match apply_project(
        app,
        state,
        parsed.0,
        &parsed.1,
        None,
        "bundled",
        Some(&label),
        true,
    ) {
        Ok((note, restored)) => {
            let wait_ms = hold_until.saturating_sub(crate::state::now_ms() as u64);
            if wait_ms > 20 {
                std::thread::sleep(std::time::Duration::from_millis(wait_ms));
            }
            // PENTING: `data` harus OBJEK (renderer: NGAJI.swapData(obj) membaca obj.pages). Sebelumnya yang dikirim
            // teks "window.NGAJI_DATA = {...}" -> swapData melempar galat -> app-bridge memanggil location.reload()
            // (muat ulang penuh + intro + lambat). Mengirim objek langsung juga menghindari baca + parse ulang file data.
            crate::perf::mark("selesai");
            let timings = crate::perf::finish(&state.paths.data_dir, &format!("kitab_open {id}"));
            json!({
                "ok": true,
                "swap": true,
                "data": swap_obj,
                "note": note,
                "restored": restored > 0,
                "timings": timings,
            })
        }
        Err(e) => json!({ "ok": false, "error": e }),
    }
}

pub fn add_kitab(app: &AppHandle, state: &crate::state::AppState, jenis: &str) -> Value {
    let jenis = clean_jenis(jenis);
    let dest = if !jenis.is_empty() {
        state.paths.user_kitab.join(&jenis)
    } else {
        state.paths.user_kitab.clone()
    };
    let _ = fs::create_dir_all(&dest);
    let mut added = 0usize;
    let mut bad: Vec<String> = Vec::new();
    let dialog_title = if !jenis.is_empty() {
        format!("Tambah kitab ke jenis {jenis}")
    } else {
        "Tambah kitab".to_owned()
    };
    let files = dialogs::pick_files(
        app,
        &dialog_title,
        &[("File .ngaji", &[data::PROJECT_EXT, "safinah"])],
    );
    if files.is_empty() {
        return json!({ "ok": false, "canceled": true });
    }
    let mut added = 0usize;
    let mut bad: Vec<String> = Vec::new();
    for src in files {
        let base = match src.file_name().and_then(|s| s.to_str()) {
            Some(n) => n.to_owned(),
            None => continue,
        };
        let src_text = match fs::read_to_string(&src) {
            Ok(s) => s,
            Err(_) => {
                bad.push(base.clone());
                continue;
            }
        };
        if data::parse_project(&src_text).is_err() {
            bad.push(base.clone());
            continue;
        }
        let name_base = if has_kitab_ext(&base) {
            base.clone()
        } else {
            format!("{base}.{}", data::PROJECT_EXT)
        };
        let ext = Path::new(&name_base)
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| format!(".{s}"))
            .unwrap_or_default();
        let stem = name_base.strip_suffix(&ext).unwrap_or(&name_base);
        let mut n = 2usize;
        let mut name = name_base.clone();
        while dest.join(&name).exists() {
            name = format!("{stem} ({n}){ext}");
            n += 1;
        }
        if fs::copy(&src, dest.join(&name)).is_ok() {
            added += 1;
        }
    }
    if !bad.is_empty() {
        let msg = if added > 0 {
            "Sebagian file tidak ditambahkan."
        } else {
            "File tidak ditambahkan."
        };
        dialogs::info(
            app,
            msg,
            Some(&format!("Bukan file proyek Ngaji yang sah:\n{}", bad.join("\n"))),
            tauri_plugin_dialog::MessageDialogKind::Warning,
        );
    }
    json!({ "ok": added > 0, "added": added })
}

pub fn open_kitab_folder(app: &AppHandle, state: &crate::state::AppState, jenis: &str) -> Value {
    let jenis = clean_jenis(jenis);
    let dir = if !jenis.is_empty() {
        state.paths.user_kitab.join(&jenis)
    } else {
        state.paths.user_kitab.clone()
    };
    let _ = fs::create_dir_all(&dir);
    match dialogs::open_folder(&dir) {
        true => json!({ "ok": true }),
        false => json!({ "ok": false, "error": "Tidak dapat membuka folder." }),
    }
}

/// Mencari file kitab dari id: (folder akar, path file). Berlaku untuk kitab pengguna ("u") maupun kitab di folder
/// bawaan ("b"); bila folder bawaan hanya-baca (mis. terpasang di Program Files), operasi gagal dengan pesan galat.
fn kitab_file(
    app: &AppHandle,
    state: &crate::state::AppState,
    id: &str,
) -> Result<(std::path::PathBuf, std::path::PathBuf), String> {
    let id = id.trim();
    let (src, rel) = id
        .split_once(':')
        .ok_or_else(|| "Nama kitab tidak valid".to_owned())?;
    let root = match src {
        "u" => state.paths.user_kitab.clone(),
        "b" => crate::state::bundled_kitab_dir(app),
        _ => return Err("Nama kitab tidak valid".to_owned()),
    };
    let parts: Vec<&str> = rel.split('/').collect();
    if parts.iter().any(|p| p.is_empty() || *p == "." || *p == "..")
        || !has_kitab_ext(parts.last().copied().unwrap_or(""))
    {
        return Err("Nama kitab tidak valid".to_owned());
    }
    let mut file = root.clone();
    for p in &parts {
        file.push(p);
    }
    if !file.is_file() {
        return Err("File kitab tidak ditemukan.".to_owned());
    }
    Ok((root, file))
}

pub fn delete_kitab(app: &AppHandle, state: &crate::state::AppState, id: &str) -> Value {
    let (_root, file) = match kitab_file(app, state, id) {
        Ok(f) => f,
        Err(e) => return json!({ "ok": false, "error": e }),
    };
    let name = file
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or_default()
        .to_owned();
    if !dialogs::ask(
        app,
        &format!("Hapus kitab “{}”?", title_stem(&name)),
        Some("File kitab dihapus permanen dari folder kitab dan tidak bisa dikembalikan."),
    ) {
        return json!({ "ok": false, "canceled": true });
    }
    match fs::remove_file(&file) {
        Ok(_) => {
            SUMMARY_CACHE
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .remove(&file);
            json!({ "ok": true, "deleted": true })
        }
        Err(e) => json!({ "ok": false, "error": format!("Gagal menghapus kitab (folder mungkin hanya-baca): {e}") }),
    }
}

pub fn move_kitab(app: &AppHandle, state: &crate::state::AppState, id: &str, jenis: &str) -> Value {
    let (root, file) = match kitab_file(app, state, id) {
        Ok(f) => f,
        Err(e) => return json!({ "ok": false, "error": e }),
    };
    let src = id.trim().split(':').next().unwrap_or("u").to_owned();
    let jenis = clean_jenis(jenis);
    if jenis.is_empty() {
        return json!({ "ok": false, "error": "Nama jenis tidak valid." });
    }
    let dest = root.join(&jenis);
    if file.parent() == Some(dest.as_path()) {
        return json!({ "ok": false, "error": "Kitab sudah berada di jenis ini." });
    }
    if let Err(e) = fs::create_dir_all(&dest) {
        return json!({ "ok": false, "error": format!("Gagal membuat folder jenis (folder mungkin hanya-baca): {e}") });
    }
    let base = file
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or_default()
        .to_owned();
    let ext = Path::new(&base)
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| format!(".{s}"))
        .unwrap_or_default();
    let stem = base.strip_suffix(&ext).unwrap_or(&base).to_owned();
    let mut name = base.clone();
    let mut n = 2usize;
    while dest.join(&name).exists() {
        name = format!("{stem} ({n}){ext}");
        n += 1;
    }
    let target = dest.join(&name);
    // rename gagal bila beda drive: salin lalu hapus asli
    if fs::rename(&file, &target).is_err() {
        if let Err(e) = fs::copy(&file, &target).and_then(|_| fs::remove_file(&file)) {
            let _ = fs::remove_file(&target);
            return json!({ "ok": false, "error": format!("Gagal memindahkan kitab: {e}") });
        }
    }
    SUMMARY_CACHE
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .remove(&file);
    json!({ "ok": true, "jenis": jenis, "id": format!("{src}:{jenis}/{name}") })
}
