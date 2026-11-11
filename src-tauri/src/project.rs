use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};

use crate::data;
use crate::dialogs::{self, LeaveChoice};
use crate::fonts;
use crate::protocol::emit_event;
use crate::state::{self, AppState};

pub fn is_project_file(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|s| s.to_str())
            .map(|s| s.to_lowercase())
            .as_deref(),
        Some("ngaji") | Some("safinah")
    )
}

pub fn update_title(app: &AppHandle, state: &AppState) {
    let Some(win) = app.get_webview_window("main") else {
        return;
    };
    let prefix = if state.project_dirty() { "• " } else { "" };
    let title = format!("{}{} — Ngaji", prefix, state.project_name());
    let _ = win.set_title(&title);
}

pub fn schedule_title_update(app: &AppHandle, state: &AppState) {
    let generation = state.title_generation.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(1000));
        let state = app.state::<AppState>();
        if state
            .title_generation
            .load(std::sync::atomic::Ordering::SeqCst)
            != generation
        {
            return;
        }
        update_title(&app, &state);
    });
}

pub fn flush_renderer(app: &AppHandle) {
    let Some(win) = app.get_webview_window("main") else {
        return;
    };
    let _ = crate::cdp::eval_js(
        &win,
        "window.__ngajiFlush ? window.__ngajiFlush() : null",
        true,
    );
}

pub fn reload_app(
    app: &AppHandle,
    state: &AppState,
    message: Option<&str>,
    hold_until: Option<u64>,
) {
    let Some(win) = app.get_webview_window("main") else {
        return;
    };
    if let Some(text) = message {
        state.lock_startup().pending_toast = Some(text.to_owned());
    }
    if let Some(until) = hold_until {
        let now = state::now_ms() as u64;
        if until > now + 20 {
            std::thread::sleep(Duration::from_millis(until - now));
        }
    }
    let _ = win.reload();
}

pub fn confirm_leave(app: &AppHandle, state: &AppState) -> bool {
    flush_renderer(app);
    confirm_leave_after_flush(app, state)
}

/// Sama seperti `confirm_leave` tetapi TANPA flush renderer. Dipakai bila pemanggil (renderer) sudah menyimpan
/// lebih dulu (mis. NGAJI.openKitab memanggil flush() sebelum command) — menghindari satu putaran CDP yang lambat.
pub fn confirm_leave_after_flush(app: &AppHandle, state: &AppState) -> bool {
    if !state.project_dirty() {
        return true;
    }
    let saved = state.config_str("projectPath").is_some();
    let detail = format!(
        "{}\n\nBila tidak disimpan, isi saat ini tetap dicadangkan otomatis (Berkas → Buka Folder Data → backups).",
        if saved {
            "Ada perubahan yang belum disimpan ke file proyek."
        } else {
            "Proyek ini belum pernah disimpan ke file."
        }
    );
    match dialogs::confirm_leave_dialog(
        app,
        &format!(
            "Simpan perubahan pada \"{}\" dulu?",
            state.project_name()
        ),
        &detail,
    ) {
        LeaveChoice::Cancel => false,
        LeaveChoice::Discard => true,
        LeaveChoice::Save => match save_project(app, state, false) {
            Ok(result) if result.get("ok").and_then(Value::as_bool) == Some(true) => true,
            Ok(result) if result.get("canceled").and_then(Value::as_bool) == Some(true) => false,
            Ok(result) => {
                dialogs::info(
                    app,
                    "Gagal menyimpan proyek.",
                    result.get("error").and_then(Value::as_str),
                    tauri_plugin_dialog::MessageDialogKind::Error,
                );
                false
            }
            Err(e) => {
                dialogs::info(
                    app,
                    "Gagal menyimpan proyek.",
                    Some(&e),
                    tauri_plugin_dialog::MessageDialogKind::Error,
                );
                false
            }
        },
    }
}

pub fn save_project(
    app: &AppHandle,
    state: &AppState,
    force_dialog: bool,
) -> Result<Value, String> {
    flush_renderer(app);
    let raw = state.current_data_js();
    let value = data::parse_data_js(&raw)
        .ok_or_else(|| "Data kerja tidak terbaca.".to_owned())?;
    let obj = data::normalize(value)?;
    let cfg = state.read_config();
    let mut target = cfg
        .get("projectPath")
        .and_then(Value::as_str)
        .map(PathBuf::from);

    let needs_dialog = force_dialog
        || target
            .as_ref()
            .map(|p| p.parent().map(|d| !d.is_dir()).unwrap_or(true))
            .unwrap_or(true);
    if needs_dialog {
        let default = target.clone().unwrap_or_else(|| {
            dialogs::documents_dir(app).join(format!(
                "{}.{}",
                state::safe_file_name(
                    obj.get("title")
                        .and_then(Value::as_str)
                        .unwrap_or("proyek")
                ),
                data::PROJECT_EXT
            ))
        });
        let Some(picked) = dialogs::save_file(
            app,
            if force_dialog {
                "Simpan proyek sebagai"
            } else {
                "Simpan proyek"
            },
            Some(default),
            &[("File .ngaji", &[data::PROJECT_EXT])],
        ) else {
            return Ok(json!({ "ok": false, "canceled": true }));
        };
        let mut picked = picked;
        if picked
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| s.eq_ignore_ascii_case(data::PROJECT_EXT))
            .unwrap_or(false)
        {
            target = Some(picked);
        } else {
            picked.set_extension(data::PROJECT_EXT);
            target = Some(picked);
        }
    }

    let target = target.ok_or_else(|| "Lokasi proyek tidak diketahui.".to_owned())?;
    let fonts = fonts::fonts_for_project(state, &obj);
    let content = data::compose_project(&obj, &fonts, &state.app_version);
    state::write_atomic(&target, content.as_bytes()).map_err(|e| e.to_string())?;

    let mut cfg = state.read_config();
    if let Some(obj) = cfg.as_object_mut() {
        obj.insert(
            "projectPath".into(),
            json!(target.to_string_lossy().to_string()),
        );
        obj.insert("projectHash".into(), json!(state.working_hash()));
    }
    state.write_config(&cfg);
    update_title(app, state);
    Ok(json!({ "ok": true, "path": target.to_string_lossy().to_string() }))
}

pub fn save_project_ui(app: &AppHandle, state: &AppState, force_dialog: bool) -> Value {
    match save_project(app, state, force_dialog) {
        Ok(result) => {
            if result.get("ok").and_then(Value::as_bool) == Some(true) {
                if let Some(path) = result.get("path").and_then(Value::as_str) {
                    emit_event("app:toast", json!(format!("Proyek tersimpan: {path}")));
                }
            } else if result.get("canceled").and_then(Value::as_bool) != Some(true) {
                dialogs::info(
                    app,
                    "Gagal menyimpan proyek.",
                    result.get("error").and_then(Value::as_str),
                    tauri_plugin_dialog::MessageDialogKind::Error,
                );
            }
            result
        }
        Err(e) => {
            dialogs::info(
                app,
                "Gagal menyimpan proyek.",
                Some(&e),
                tauri_plugin_dialog::MessageDialogKind::Error,
            );
            json!({ "ok": false, "error": e })
        }
    }
}

pub fn apply_project(
    app: &AppHandle,
    state: &AppState,
    obj: Value,
    project_fonts: &[Value],
    file_path: Option<&Path>,
    message: &str,
    label: Option<&str>,
    in_place: bool,
) -> Result<(String, usize), String> {
    crate::perf::mark("apply:mulai");
    // Cadangan data lama ditulis di thread lain: tidak perlu menunggu disk (apalagi dengan antivirus) sebelum kitab tampil.
    if let Some(raw) = state::read_if_exists(&state.paths.data) {
        let app2 = app.clone();
        std::thread::spawn(move || {
            app2.state::<AppState>().backup_content("data", &raw);
        });
    }
    crate::perf::mark("apply:cadangan");
    let restored = fonts::restore_fonts(state, project_fonts);
    crate::perf::mark("apply:font");
    let content = data::compose_data_js(&obj, false);
    state::write_atomic(&state.paths.data, content.as_bytes()).map_err(|e| e.to_string())?;
    crate::perf::mark("apply:tulis-data");

    let mut cfg = state.read_config();
    {
        let Some(c) = cfg.as_object_mut() else {
            return Err("Konfigurasi tidak valid.".to_owned());
        };
        match file_path {
            Some(p) => {
                c.insert(
                    "projectPath".into(),
                    json!(p.to_string_lossy().to_string()),
                );
            }
            None => {
                c.insert("projectPath".into(), Value::Null);
            }
        }
        if message == "bundled" {
            c.insert(
                "bundledName".into(),
                json!(label.unwrap_or("Tanpa Judul")),
            );
        } else {
            c.remove("bundledName");
        }
        let hash = if file_path.is_some() || message == "new" || message == "bundled" {
            json!(state::content_hash(&obj))
        } else {
            Value::Null
        };
        c.insert("projectHash".into(), hash);
    }
    state.write_config(&cfg);

    let note = if message == "new" {
        "Proyek baru dibuat.".to_owned()
    } else {
        let base = file_path
            .and_then(|p| p.file_name())
            .and_then(|s| s.to_str())
            .or(label)
            .unwrap_or("data");
        format!(
            "Proyek dibuka: {base}{}",
            if restored > 0 {
                format!(" ({restored} font dipulihkan)")
            } else {
                String::new()
            }
        )
    };
    crate::perf::mark("apply:config");
    if in_place {
        // judul jendela diperbarui di thread lain (update_title menghitung ulang "berubah?" = baca + parse data)
        schedule_title_update(app, state);
        return Ok((note, restored));
    }
    state.lock_startup().reveal = true;
    reload_app(app, state, Some(&note), None);
    update_title(app, state);
    Ok((note, restored))
}

pub fn open_project_path(app: &AppHandle, state: &AppState, file: Option<PathBuf>) -> Value {
    if !confirm_leave(app, state) {
        return json!({ "ok": false, "canceled": true });
    }
    let file = match file {
        Some(f) => f,
        None => {
            let Some(f) = dialogs::pick_file(
                app,
                "Buka proyek",
                &[
                    ("File .ngaji", &[data::PROJECT_EXT, "safinah"]),
                    ("Data lama (.js / .json)", &["js", "json"]),
                ],
            ) else {
                return json!({ "ok": false, "canceled": true });
            };
            f
        }
    };

    let src = match fs::read_to_string(&file) {
        Ok(s) => s.trim_start_matches('\u{feff}').to_owned(),
        Err(e) => {
            dialogs::info(
                app,
                "File tidak dapat dibuka.",
                Some(&e.to_string()),
                tauri_plugin_dialog::MessageDialogKind::Error,
            );
            return json!({ "ok": false, "error": e.to_string() });
        }
    };

    let as_project = data::looks_like_project(&src) || is_project_file(&file);
    let parsed = if as_project {
        data::parse_project(&src)
            .map(|(data, fonts)| (data, fonts, true))
    } else {
        let value = if file
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| s.eq_ignore_ascii_case("json"))
            .unwrap_or(false)
        {
            serde_json::from_str::<Value>(&src).map_err(|e| e.to_string())
        } else {
            data::parse_data_js(&src).ok_or_else(|| "Data tidak ditemukan.".to_owned())
        };
        value
            .and_then(|v| data::normalize(v))
            .map(|data| (data, Vec::new(), false))
    };

    let (obj, project_fonts, as_project) = match parsed {
        Ok(v) => v,
        Err(e) => {
            dialogs::info(
                app,
                "File tidak dapat dibuka.",
                Some(&e),
                tauri_plugin_dialog::MessageDialogKind::Error,
            );
            return json!({ "ok": false, "error": e });
        }
    };

    let path = if as_project { Some(file.as_path()) } else { None };
    let label = if as_project {
        None
    } else {
        file.file_name().and_then(|s| s.to_str())
    };
    let message = if as_project { "open" } else { "legacy" };
    match apply_project(app, state, obj, &project_fonts, path, message, label, false) {
        Ok((note, _)) => json!({ "ok": true, "path": file.to_string_lossy().to_string(), "note": note }),
        Err(e) => json!({ "ok": false, "error": e }),
    }
}

pub fn new_project(app: &AppHandle, state: &AppState) -> Value {
    if !confirm_leave(app, state) {
        return json!({ "ok": false, "canceled": true });
    }
    match apply_project(
        app,
        state,
        data::blank_project(),
        &[],
        None,
        "new",
        None,
        false,
    ) {
        Ok(_) => json!({ "ok": true }),
        Err(e) => json!({ "ok": false, "error": e }),
    }
}

pub fn import_data(app: &AppHandle, state: &AppState) -> Value {
    let Some(file) = dialogs::pick_file(
        app,
        "Impor data (.js atau .json)",
        &[("Data Ngaji", &["js", "json"]), ("Semua file", &["*"])],
    ) else {
        return json!({ "ok": false, "canceled": true });
    };
    let src = match fs::read_to_string(&file) {
        Ok(s) => s.trim_start_matches('\u{feff}').to_owned(),
        Err(e) => {
            dialogs::info(
                app,
                "File data tidak valid.",
                Some(&e.to_string()),
                tauri_plugin_dialog::MessageDialogKind::Error,
            );
            return json!({ "ok": false, "error": e.to_string() });
        }
    };
    let value = if file
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.eq_ignore_ascii_case("json"))
        .unwrap_or(false)
    {
        serde_json::from_str::<Value>(&src).map_err(|e| e.to_string())
    } else {
        data::parse_data_js(&src).ok_or_else(|| "Data tidak ditemukan.".to_owned())
    };
    let obj = match value.and_then(data::normalize) {
        Ok(v) => v,
        Err(e) => {
            dialogs::info(
                app,
                "File data tidak valid.",
                Some(&e),
                tauri_plugin_dialog::MessageDialogKind::Error,
            );
            return json!({ "ok": false, "error": e });
        }
    };
    let pages = obj
        .get("pages")
        .and_then(Value::as_array)
        .map(|a| a.len())
        .unwrap_or(0);
    let sentences: usize = obj
        .get("pages")
        .and_then(Value::as_array)
        .map(|pages| {
            pages
                .iter()
                .map(|p| {
                    p.get("sentences")
                        .and_then(Value::as_array)
                        .map(|s| s.len())
                        .unwrap_or(0)
                })
                .sum()
        })
        .unwrap_or(0);
    if !dialogs::ask(
        app,
        "Ganti data saat ini dengan isi file ini?",
        Some(&format!(
            "{pages} halaman, {sentences} kalimat.\n\nData saat ini dicadangkan otomatis."
        )),
    ) {
        return json!({ "ok": false, "canceled": true });
    }
    flush_renderer(app);
    state.backup_current_data();
    let content = data::compose_data_js(&obj, false);
    if let Err(e) = state::write_atomic(&state.paths.data, content.as_bytes()) {
        return json!({ "ok": false, "error": e.to_string() });
    }
    reload_app(app, state, None, None);
    update_title(app, state);
    json!({ "ok": true })
}

pub fn export_json(app: &AppHandle, state: &AppState) -> Value {
    flush_renderer(app);
    let raw = state.current_data_js();
    let obj = data::parse_data_js(&raw).unwrap_or_else(|| json!({}));
    let Some(target) = dialogs::save_file(
        app,
        "Ekspor data (JSON)",
        Some(dialogs::documents_dir(app).join("ngaji-data.json")),
        &[("JSON", &["json"])],
    ) else {
        return json!({ "ok": false, "canceled": true });
    };
    let text = match serde_json::to_string_pretty(&obj) {
        Ok(t) => t,
        Err(e) => return json!({ "ok": false, "error": e.to_string() }),
    };
    if let Err(e) = fs::write(&target, text) {
        dialogs::info(
            app,
            "Gagal mengekspor data.",
            Some(&e.to_string()),
            tauri_plugin_dialog::MessageDialogKind::Error,
        );
        return json!({ "ok": false, "error": e.to_string() });
    }
    dialogs::info(
        app,
        "Data berhasil diekspor.",
        Some(&target.to_string_lossy()),
        tauri_plugin_dialog::MessageDialogKind::Info,
    );
    json!({ "ok": true, "path": target.to_string_lossy().to_string() })
}

pub fn export_data_js(app: &AppHandle, state: &AppState, json_text: &str) -> Value {
    let value = match serde_json::from_str::<Value>(json_text) {
        Ok(v) => v,
        Err(e) => return json!({ "ok": false, "error": format!("JSON tidak valid: {e}") }),
    };
    let obj = match data::normalize(value) {
        Ok(v) => v,
        Err(e) => return json!({ "ok": false, "error": e }),
    };
    let content = data::compose_data_js(&obj, false);
    let Some(target) = dialogs::save_file(
        app,
        "Ekspor data (.js)",
        Some(dialogs::documents_dir(app).join("ngaji-data-ekspor.js")),
        &[("File data JavaScript", &["js"])],
    ) else {
        return json!({ "ok": false, "canceled": true });
    };
    if let Err(e) = fs::write(&target, content) {
        return json!({ "ok": false, "error": e.to_string() });
    }
    json!({ "ok": true, "path": target.to_string_lossy().to_string() })
}

pub fn reset_all(app: &AppHandle, state: &AppState) -> Value {
    if !dialogs::ask(
        app,
        "Reset halaman, kalimat, pegon, dhomir, keterangan, dan pengaturan ke data bawaan?",
        Some("Data saat ini dicadangkan otomatis."),
    ) {
        return json!({ "ok": false, "canceled": true });
    }
    flush_renderer(app);
    state.reset_data();
    reload_app(app, state, None, None);
    update_title(app, state);
    json!({ "ok": true })
}

pub fn start_blank(state: &AppState) {
    state.backup_current_data();
    let blank = data::blank_project();
    let content = data::compose_data_js(&blank, false);
    if state::write_atomic(&state.paths.data, content.as_bytes()).is_err() {
        return;
    }
    let mut cfg = state.read_config();
    if let Some(c) = cfg.as_object_mut() {
        c.remove("projectPath");
        c.remove("bundledName");
        c.insert(
            "projectHash".into(),
            json!(state::content_hash(&blank)),
        );
    }
    state.write_config(&cfg);
}
