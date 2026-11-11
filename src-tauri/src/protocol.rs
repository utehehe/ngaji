use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use tauri::http::{Request, Response};
use tauri::UriSchemeContext;

use crate::state::AppState;
use crate::fonts;
use crate::project;
use crate::kitab;
use crate::dialogs;

const SCHEME: &str = "ngaji";

static EVENT_COUNTER: AtomicU64 = AtomicU64::new(0);
pub struct PendingEvent {
    pub event: String,
    pub payload: Value,
}
lazy_static::lazy_static! {
    pub static ref PENDING_EVENTS: Mutex<Vec<PendingEvent>> = Mutex::new(Vec::new());
}

pub fn emit_event(event: &str, payload: Value) {
    let mut events = PENDING_EVENTS.lock().unwrap();
    events.push(PendingEvent {
        event: event.to_owned(),
        payload,
    });
    // keep only last 200
    while events.len() > 200 {
        events.remove(0);
    }
}

pub fn build_response(body: Vec<u8>, content_type: &str) -> Response<Vec<u8>> {
    Response::builder()
        .status(200)
        .header("content-type", content_type)
        .header("cache-control", "no-store")
        .header("access-control-allow-origin", "*")
        .body(body)
        .unwrap()
}

pub fn error_response(status: u16, message: &str) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header("content-type", "text/plain; charset=utf-8")
        .header("access-control-allow-origin", "*")
        .body(message.as_bytes().to_vec())
        .unwrap()
}

/// Extract the path portion from a custom-protocol URI.
/// Examples:
///   ngaji://localhost/index.html          -> /index.html
///   http://ngaji.localhost/data/x.js      -> /data/x.js
///   ngaji://localhost/                    -> /
pub fn extract_path(uri: &str) -> String {
    let after_scheme = uri.split("://").nth(1).unwrap_or(uri);
    let path = after_scheme.splitn(2, '/').nth(1).unwrap_or("");
    if path.is_empty() {
        "/".to_owned()
    } else {
        format!("/{path}")
    }
}

pub fn mime_type(rel: &str) -> &str {
    match Path::new(rel)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
        "html" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" => "text/javascript; charset=utf-8",
        "mjs" => "text/javascript; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "wasm" => "application/wasm",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "png" => "image/png",
        "jpg" => "image/jpeg",
        "jpeg" => "image/jpeg",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "wav" => "audio/wav",
        _ => "application/octet-stream",
    }
}

/// Dekode persen + tolak path berbahaya (`..`, absolut, drive). Mengembalikan path relatif aman.
pub fn safe_rel(raw: &str) -> Option<PathBuf> {
    let decoded = percent_encoding::percent_decode_str(raw).decode_utf8().ok()?;
    let mut out = PathBuf::new();
    for comp in Path::new(decoded.as_ref()).components() {
        match comp {
            std::path::Component::Normal(c) => out.push(c),
            std::path::Component::CurDir => {}
            _ => return None,
        }
    }
    if out.as_os_str().is_empty() { None } else { Some(out) }
}

pub fn serve_asset(app: &AppHandle, path: &str) -> Response<Vec<u8>> {
    let rel_path = match safe_rel(path.strip_prefix('/').unwrap_or(path)) {
        Some(p) => p,
        None => return error_response(404, "Not found"),
    };
    let rel_owned = rel_path.to_string_lossy().replace('\\', "/");
    let rel = rel_owned.as_str();
    // 1) Try embedded asset resolver (production)
    if let Some(asset) = app.asset_resolver().get(rel.to_owned()) {
        return build_response(asset.bytes, &asset.mime_type);
    }
    // 2) Fall back to loose filesystem files (dev mode)
    #[cfg(debug_assertions)]
    {
        let fs_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("app")
            .join(rel);
        if fs_path.is_file() {
            if let Ok(data) = fs::read(&fs_path) {
                return build_response(data, mime_type(rel));
            }
        }
    }
    error_response(404, "Not found")
}

pub fn serve_data(state: &AppState) -> Response<Vec<u8>> {
    let content = state.current_data_js();
    build_response(content.into_bytes(), "text/javascript; charset=utf-8")
}

pub fn serve_fonts_css(state: &AppState) -> Response<Vec<u8>> {
    let css = fonts::build_css(state);
    build_response(css.into_bytes(), "text/css; charset=utf-8")
}

pub fn serve_user_font(state: &AppState, rel: &str) -> Response<Vec<u8>> {
    let safe = match safe_rel(rel) {
        Some(p) => p,
        None => return error_response(404, "Not found"),
    };
    let path = state.paths.fonts.join(safe);
    match fs::read(&path) {
        Ok(data) => {
            let mime = match path.extension().and_then(|s| s.to_str()).unwrap_or("") {
                "ttf" => "font/ttf",
                "otf" => "font/otf",
                "woff" => "font/woff",
                "woff2" => "font/woff2",
                _ => "application/octet-stream",
            };
            build_response(data, mime)
        }
        Err(_) => error_response(404, "Not found"),
    }
}

pub fn serve_startup_info(state: &AppState) -> Response<Vec<u8>> {
    let snap = state.lock_startup().take_for_page();
    let (intro, launcher, reveal, had_open, deferred, pending_toast) = (
        snap.intro, snap.launcher, snap.reveal, snap.had_open, snap.deferred, snap.pending_toast,
    );
    // tutorial tampil bila BELUM pernah diselesaikan / dilewati
    let tour = !state.config_bool("tourDone").unwrap_or(false);
    let info = json!({
        "intro": intro,
        "launcher": launcher,
        "project": state.project_name(),
        "reveal": reveal,
        "tour": tour,
        "hadOpen": had_open,
        "deferred": deferred,
        "pendingToast": pending_toast,
    });
    // serde_json menghasilkan JSON yang juga literal JavaScript valid (string di-escape dengan benar)
    let js = format!("window.__NGAJI_STARTUP_PRELOAD__ = {};", info);
    build_response(js.into_bytes(), "text/javascript; charset=utf-8")
}

/// Parse query string into key-value pairs
pub fn parse_query(query: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for pair in query.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            map.insert(
                percent_decode(k),
                percent_decode(v),
            );
        }
    }
    map
}

fn percent_decode(s: &str) -> String {
    // Dekode UTF-8 yang benar (teks Arab / "…" memakai beberapa byte per karakter).
    percent_encoding::percent_decode_str(s).decode_utf8_lossy().into_owned()
}

/// Handle /__invoke — dispatch command to underlying Rust function
pub fn serve_invoke(app: &AppHandle, state: &AppState, cmd: &str, args_json: &str) -> Response<Vec<u8>> {
    let args: Value = serde_json::from_str(args_json).unwrap_or(Value::Null);
    let result: Value = match cmd {
        "data_save" => {
            let json = args.get("json").and_then(Value::as_str).unwrap_or("").to_owned();
            state.save_data(&json)
        }
        "data_save_sync" => json!({ "ok": true }),
        "data_reset" => project::reset_all(app, &*state),
        "js_export" => {
            let json = args.get("json").and_then(Value::as_str).unwrap_or("").to_owned();
            project::export_data_js(app, &*state, &json)
        }
        "dialog_alert" => json!({ "ok": true }),
        "dialog_confirm" => json!({ "ok": true }),
        "fonts_list" => json!(fonts::font_families(&*state)),
        "fonts_add" => fonts::add_font_files(app, &*state),
        "action_run" => {
            let name = args.get("name").and_then(Value::as_str).unwrap_or("").to_owned();
            match name.as_str() {
                "save" => project::save_project_ui(app, &*state, false),
                "save-as" => project::save_project_ui(app, &*state, true),
                "open-project" => project::open_project_path(app, &*state, None),
                "new-project" => project::new_project(app, &*state),
                "import-data" => project::import_data(app, &*state),
                "export-json" => project::export_json(app, &*state),
                "reset-data" => project::reset_all(app, &*state),
                "open-data-folder" => {
                    let ok = dialogs::open_folder(&(*state).paths.data_dir);
                    json!({ "ok": ok })
                }
                "open-fonts-folder" => {
                    let ok = dialogs::open_folder(&(*state).paths.fonts);
                    json!({ "ok": ok })
                }
                "reload" => {
                    project::flush_renderer(app);
                    project::reload_app(app, &*state, None, None);
                    json!({ "ok": true })
                }
                "about" => {
                    dialogs::info(
                        app,
                        "Ngaji",
                        Some(&format!("Versi {}\n\nFolder data:\n{}", env!("CARGO_PKG_VERSION"), (*state).paths.data_dir.display())),
                        tauri_plugin_dialog::MessageDialogKind::Info,
                    );
                    json!({ "ok": true })
                }
                "check-updates" => crate::update::check_update(&*state, true),
                "launcher" | "tour" | "clean-view" | "undo" | "redo" => {
                    emit_event("menu:action", json!(name));
                    json!({ "ok": true })
                }
                _ => json!({ "ok": false, "error": "Aksi tidak dikenal" }),
            }
        }
        "app_startup" => {
            let snap = state.lock_startup().take_for_page();
            json!({
                "intro": snap.intro,
                "launcher": snap.launcher,
                "project": (*state).project_name(),
                "reveal": snap.reveal,
                "tour": !(*state).config_bool("tourDone").unwrap_or(false),
                "pendingToast": snap.pending_toast,
            })
        }
        "tour_done" => {
            let mut cfg = (*state).read_config();
            if let Some(obj) = cfg.as_object_mut() {
                obj.insert("tourDone".into(), json!(true));
            }
            (*state).write_config(&cfg);
            json!({ "ok": true })
        }
        "kitab_list" => kitab::list_kitab(app, &*state),
        "kitab_open" => {
            let id = args.get("id").and_then(Value::as_str).unwrap_or("").to_owned();
            let hold = args.get("hold").and_then(Value::as_u64).unwrap_or(0);
            kitab::open_kitab(app, &*state, &id, hold)
        }
        "kitab_add" => {
            let jenis = args.get("jenis").and_then(Value::as_str).unwrap_or("").to_owned();
            kitab::add_kitab(app, &*state, &jenis)
        }
        "kitab_folder" => {
            let jenis = args.get("jenis").and_then(Value::as_str).unwrap_or("").to_owned();
            kitab::open_kitab_folder(app, &*state, &jenis)
        }
        "titlebar_info" => json!({
            "labels": ["Berkas", "Edit", "Tampilan", "Bantuan"],
            "zoom": 1.0,
            "h": 34
        }),
        "titlebar_menu" => {
            let idx = args.get("idx").and_then(Value::as_u64).unwrap_or(0) as u32;
            let labels = ["Berkas", "Edit", "Tampilan", "Bantuan"];
            let label = labels.get(idx as usize).cloned().unwrap_or("");
            let items: Vec<Value> = match label {
                "Berkas" => vec![
                    json!({ "label": "Pilih Kitab…", "acc": "Ctrl+K", "enabled": true, "visible": true }),
                    json!({ "sep": true }),
                    json!({ "label": "Proyek Baru", "acc": "Ctrl+N", "enabled": true, "visible": true }),
                    json!({ "label": "Buka Proyek…", "acc": "Ctrl+O", "enabled": true, "visible": true }),
                    json!({ "label": "Simpan Proyek", "acc": "Ctrl+S", "enabled": true, "visible": true }),
                    json!({ "label": "Simpan Proyek Sebagai…", "acc": "Ctrl+Shift+S", "enabled": true, "visible": true }),
                    json!({ "sep": true }),
                    json!({ "label": "Ekspor Data (.js)…", "acc": "Ctrl+E", "enabled": true, "visible": true }),
                    json!({ "label": "Impor Data (.js / .json)…", "acc": "Ctrl+I", "enabled": true, "visible": true }),
                    json!({ "label": "Ekspor Data (JSON)…", "enabled": true, "visible": true }),
                    json!({ "label": "Reset Data ke Bawaan…", "enabled": true, "visible": true }),
                    json!({ "sep": true }),
                    json!({ "label": "Buka Folder Data", "enabled": true, "visible": true }),
                    json!({ "label": "Buka Folder Font Lokal", "enabled": true, "visible": true }),
                    json!({ "sep": true }),
                    json!({ "label": "Keluar", "enabled": true, "visible": true }),
                ],
                "Edit" => vec![
                    json!({ "label": "Urungkan", "acc": "Ctrl+Z", "enabled": true, "visible": true }),
                    json!({ "label": "Ulangi", "acc": "Ctrl+Y", "enabled": true, "visible": true }),
                    json!({ "sep": true }),
                    json!({ "label": "Potong", "acc": "Ctrl+X", "enabled": true, "visible": true }),
                    json!({ "label": "Salin", "acc": "Ctrl+C", "enabled": true, "visible": true }),
                    json!({ "label": "Tempel", "acc": "Ctrl+V", "enabled": true, "visible": true }),
                    json!({ "label": "Pilih Semua", "acc": "Ctrl+A", "enabled": true, "visible": true }),
                ],
                "Tampilan" => vec![
                    json!({ "label": "Muat Ulang", "acc": "Ctrl+R", "enabled": true, "visible": true }),
                    json!({ "label": "Tampilan Bersih", "acc": "Ctrl+Shift+H", "enabled": true, "visible": true }),
                    json!({ "label": "Layar Penuh", "acc": "F11", "enabled": true, "visible": true }),
                    json!({ "sep": true }),
                    json!({ "label": "Perbesar (Ctrl +)", "enabled": true, "visible": true }),
                    json!({ "label": "Perkecil (Ctrl -)", "enabled": true, "visible": true }),
                    json!({ "label": "Ukuran Asli (Ctrl 0)", "enabled": true, "visible": true }),
                    json!({ "sep": true }),
                    json!({ "label": "Alat Pengembang", "acc": "Ctrl+Shift+I", "enabled": true, "visible": true }),
                ],
                "Bantuan" => vec![
                    json!({ "label": "Tutorial Penggunaan", "enabled": true, "visible": true }),
                    json!({ "sep": true }),
                    json!({ "label": "Periksa Pembaruan…", "enabled": true, "visible": true }),
                    json!({ "label": "Tentang Aplikasi", "enabled": true, "visible": true }),
                ],
                _ => vec![],
            };
            json!(items)
        }
        "titlebar_invoke" => {
            let idx = args.get("idx").and_then(Value::as_u64).unwrap_or(0) as u32;
            let sub = args.get("sub").and_then(Value::as_u64).unwrap_or(0) as u32;
            let action = match (idx, sub) {
                (0, 0) => "launcher",
                (0, 2) => "new-project",
                (0, 3) => "open-project",
                (0, 4) => "save",
                (0, 5) => "save-as",
                (0, 7) => "export-js",
                (0, 8) => "import-data",
                (0, 9) => "export-json",
                (0, 10) => "reset-data",
                (0, 12) => "open-data-folder",
                (0, 13) => "open-fonts-folder",
                (0, 15) => "quit",
                (1, 0) => "undo",
                (1, 1) => "redo",
                (1, 3) => "cut",
                (1, 4) => "copy",
                (1, 5) => "paste",
                (1, 6) => "select-all",
                (2, 0) => "reload",
                (2, 1) => "clean-view",
                (2, 2) => "fullscreen",
                (2, 4) => "zoom_in",
                (2, 5) => "zoom_out",
                (2, 6) => "zoom_reset",
                (2, 8) => "toggle_devtools",
                (3, 0) => "tour",
                (3, 2) => "check-updates",
                (3, 3) => "about",
                _ => return build_response(json!({ "ok": false }).to_string().into_bytes(), "application/json; charset=utf-8"),
            };
            if action == "quit" {
                // simpan dulu (sama seperti saat jendela ditutup), baru keluar
                let raw = state.current_data_js();
                if let Some(obj) = crate::data::parse_data_js(&raw) {
                    let json_text = serde_json::to_string(&obj).unwrap_or_default();
                    state.save_data(&json_text);
                }
                app.exit(0);
            }
            emit_event("menu:action", json!(action));
            json!({ "ok": true })
        }
        "titlebar_colors" => json!({ "ok": true }),
        "zoom_in" => {
            let zoom_state = state.zoom.lock().unwrap_or_else(|e| e.into_inner());
            let mut z = *zoom_state;
            z = (z + 0.5).min(5.0);
            drop(zoom_state);
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_zoom(z);
                emit_event("app:zoom", json!(z));
            }
            *state.zoom.lock().unwrap_or_else(|e| e.into_inner()) = z;
            json!({ "ok": true, "zoom": z })
        }
        "zoom_out" => {
            let zoom_state = state.zoom.lock().unwrap_or_else(|e| e.into_inner());
            let mut z = *zoom_state;
            z = (z - 0.5).max(0.5);
            drop(zoom_state);
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_zoom(z);
                emit_event("app:zoom", json!(z));
            }
            *state.zoom.lock().unwrap_or_else(|e| e.into_inner()) = z;
            json!({ "ok": true, "zoom": z })
        }
        "zoom_reset" => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_zoom(1.0);
                emit_event("app:zoom", json!(1.0));
            }
            *state.zoom.lock().unwrap_or_else(|e| e.into_inner()) = 1.0;
            json!({ "ok": true, "zoom": 1.0 })
        }
        "toggle_fullscreen" => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_fullscreen(!w.is_fullscreen().unwrap_or(false));
            }
            json!({ "ok": true })
        }
        "toggle_devtools" => {
            #[cfg(debug_assertions)]
            {
                if let Some(w) = app.get_webview_window("main") {
                    w.open_devtools();
                }
            }
            json!({ "ok": true })
        }
        "window_minimize" => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.minimize();
            }
            json!({ "ok": true })
        }
        "window_maximize" => {
            if let Some(w) = app.get_webview_window("main") {
                let is_max = w.is_maximized().unwrap_or(false);
                if is_max {
                    let _ = w.unmaximize();
                } else {
                    let _ = w.maximize();
                }
            }
            json!({ "ok": true })
        }
        "window_close" => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.close();
            }
            json!({ "ok": true })
        }
        "flush_now" => {
            project::flush_renderer(app);
            json!({ "ok": true })
        }
        "close_flush" => {
            let raw = (*state).current_data_js();
            if let Some(obj) = crate::data::parse_data_js(&raw) {
                let json_text = serde_json::to_string(&obj).unwrap_or_default();
                (*state).save_data(&json_text);
            }
            project::update_title(app, &*state);
            json!({ "ok": true })
        }
        _ => json!({ "ok": false, "error": format!("Command tidak dikenal: {}", cmd) }),
    };
    let body = serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_owned());
    build_response(body.into_bytes(), "application/json; charset=utf-8")
}

/// Handle /__events — polling endpoint for Tauri events
pub fn serve_events() -> Response<Vec<u8>> {
    let events: Vec<Value> = {
        let mut pending = PENDING_EVENTS.lock().unwrap();
        let evts: Vec<Value> = pending.iter().map(|e| {
            json!({ "event": e.event, "payload": e.payload })
        }).collect();
        pending.clear();
        evts
    };
    build_response(serde_json::to_string(&events).unwrap_or_else(|_| "[]".to_owned()).into_bytes(), "application/json; charset=utf-8")
}


