use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, State, WebviewWindow};

use crate::state::AppState;
use crate::project;
use crate::kitab;
use crate::update;
use crate::dialogs;
use crate::fonts;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub fn data_save(state: State<'_, AppState>, json: String) -> Value {
    state.save_data(&json)
}

#[tauri::command]
pub fn data_save_sync(_state: State<'_, AppState>, _json: String) -> Value {
    // Tauri commands are async; the sync variant is handled by close-request flush in Rust.
    json!({ "ok": true })
}

#[tauri::command]
pub fn data_reset(app: AppHandle, state: State<'_, AppState>) -> Value {
    project::reset_all(&app, &*state)
}

#[tauri::command]
pub fn js_export(app: AppHandle, state: State<'_, AppState>, json: String) -> Value {
    project::export_data_js(&app, &*state, &json)
}

#[tauri::command]
pub fn dialog_alert(app: AppHandle, message: String) -> Value {
    let _ = app.dialog().message(message).title("Ngaji").kind(tauri_plugin_dialog::MessageDialogKind::Info).buttons(tauri_plugin_dialog::MessageDialogButtons::Ok).blocking_show();
    json!({ "ok": true })
}

#[tauri::command]
pub fn dialog_confirm(app: AppHandle, message: String) -> Value {
    let result = app.dialog().message(message).title("Ngaji").kind(tauri_plugin_dialog::MessageDialogKind::Info).buttons(tauri_plugin_dialog::MessageDialogButtons::OkCancel).blocking_show_with_result();
    json!({ "ok": matches!(result, tauri_plugin_dialog::MessageDialogResult::Ok) })
}

#[tauri::command]
pub fn fonts_list(state: State<'_, AppState>) -> Value {
    json!(fonts::font_families(&*state))
}

#[tauri::command]
pub fn fonts_add(app: AppHandle, state: State<'_, AppState>) -> Value {
    fonts::add_font_files(&app, &*state)
}

#[tauri::command]
pub fn action_run(app: AppHandle, state: State<'_, AppState>, name: String) -> Value {
    match name.as_str() {
        "save" => project::save_project_ui(&app, &*state, false),
        "save-as" => project::save_project_ui(&app, &*state, true),
        "open-project" => project::open_project_path(&app, &*state, None),
        "new-project" => project::new_project(&app, &*state),
        "import-data" => project::import_data(&app, &*state),
        "export-json" => project::export_json(&app, &*state),
        "reset-data" => project::reset_all(&app, &*state),
        "open-data-folder" => {
            let ok = dialogs::open_folder(&(*state).paths.data_dir);
            json!({ "ok": ok })
        }
        "open-fonts-folder" => {
            let ok = dialogs::open_folder(&(*state).paths.fonts);
            json!({ "ok": ok })
        }
        "reload" => {
            project::flush_renderer(&app);
            project::reload_app(&app, &*state, None, None);
            json!({ "ok": true })
        }
        "about" => {
            dialogs::info(
                &app,
                "Ngaji",
                Some(&format!("Versi {}\n\nFolder data:\n{}", env!("CARGO_PKG_VERSION"), (*state).paths.data_dir.display())),
                tauri_plugin_dialog::MessageDialogKind::Info,
            );
            json!({ "ok": true })
        }
        "check-updates" => update::check_update(&*state, true),
        "launcher" | "tour" | "clean-view" | "undo" | "redo" => {
            let _ = app.emit("menu:action", &name);
            json!({ "ok": true })
        }
        _ => json!({ "ok": false, "error": "Aksi tidak dikenal" }),
    }
}

#[tauri::command]
pub fn app_startup(state: State<'_, AppState>) -> Value {
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

#[tauri::command]
pub fn tour_done(app: AppHandle, state: State<'_, AppState>) -> Value {
    let mut cfg = (*state).read_config();
    if cfg.get("tourDone").and_then(Value::as_bool) == Some(true) {
        return json!({ "ok": true });
    }
    if let Some(obj) = cfg.as_object_mut() {
        obj.insert("tourDone".into(), json!(true));
    }
    (*state).write_config(&cfg);
    json!({ "ok": true })
}

#[tauri::command]
pub fn kitab_list(app: AppHandle, state: State<'_, AppState>) -> Value {
    kitab::list_kitab(&app, &*state)
}

#[tauri::command]
pub fn kitab_open(app: AppHandle, state: State<'_, AppState>, id: String, hold: u64) -> Value {
    kitab::open_kitab(&app, &*state, &id, hold)
}

#[tauri::command]
pub fn kitab_add(app: AppHandle, state: State<'_, AppState>, jenis: String) -> Value {
    kitab::add_kitab(&app, &*state, &jenis)
}

#[tauri::command]
pub fn kitab_delete(app: AppHandle, state: State<'_, AppState>, id: String) -> Value {
    kitab::delete_kitab(&app, &*state, &id)
}

#[tauri::command]
pub fn kitab_move(app: AppHandle, state: State<'_, AppState>, id: String, jenis: String) -> Value {
    kitab::move_kitab(&app, &*state, &id, &jenis)
}

#[tauri::command]
pub fn kitab_folder(app: AppHandle, state: State<'_, AppState>, jenis: String) -> Value {
    kitab::open_kitab_folder(&app, &*state, &jenis)
}

#[tauri::command]
pub fn titlebar_info(_state: State<'_, AppState>) -> Value {
    json!({
        "labels": ["Berkas", "Edit", "Tampilan", "Bantuan"],
        "zoom": 1.0,
        "h": 34
    })
}

#[tauri::command]
pub fn titlebar_menu(_state: State<'_, AppState>, idx: u32) -> Value {
    let labels = ["Berkas", "Edit", "Tampilan", "Bantuan"];
    let label = labels.get(idx as usize).cloned().unwrap_or("");
    let items = match label {
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

#[tauri::command]
pub fn titlebar_invoke(_app: AppHandle, _state: State<'_, AppState>, idx: u32, sub: u32) -> Value {
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
        _ => return json!({ "ok": false }),
    };
    if action == "quit" {
        std::process::exit(0);
    }
    json!({ "ok": true })
}

#[tauri::command]
pub fn titlebar_colors(_app: AppHandle, _bg: String, _fg: String) -> Value {
    json!({ "ok": true })
}

#[tauri::command]
pub fn zoom_in(window: WebviewWindow, state: State<'_, AppState>) -> Value {
    let mut zoom = state.zoom.lock().unwrap_or_else(|e| e.into_inner());
    *zoom = (*zoom + 0.5).min(5.0);
    let z = *zoom;
    drop(zoom);
    let _ = window.set_zoom(z);
    let _ = window.emit("app:zoom", z);
    json!({ "ok": true, "zoom": z })
}

#[tauri::command]
pub fn zoom_out(window: WebviewWindow, state: State<'_, AppState>) -> Value {
    let mut zoom = state.zoom.lock().unwrap_or_else(|e| e.into_inner());
    *zoom = (*zoom - 0.5).max(0.5);
    let z = *zoom;
    drop(zoom);
    let _ = window.set_zoom(z);
    let _ = window.emit("app:zoom", z);
    json!({ "ok": true, "zoom": z })
}

#[tauri::command]
pub fn zoom_reset(window: WebviewWindow, state: State<'_, AppState>) -> Value {
    let mut zoom = state.zoom.lock().unwrap_or_else(|e| e.into_inner());
    *zoom = 1.0;
    let _ = window.set_zoom(1.0);
    drop(zoom);
    let _ = window.emit("app:zoom", 1.0);
    json!({ "ok": true, "zoom": 1.0 })
}

#[tauri::command]
pub fn toggle_fullscreen(window: WebviewWindow) -> Value {
    let _ = window.set_fullscreen(!window.is_fullscreen().unwrap_or(false));
    json!({ "ok": true })
}

#[tauri::command]
pub fn toggle_devtools(window: WebviewWindow) -> Value {
    #[cfg(debug_assertions)]
    {
        let _ = window.open_devtools();
    }
    json!({ "ok": true })
}

#[tauri::command]
pub fn window_minimize(window: WebviewWindow) -> Value {
    let _ = window.minimize();
    json!({ "ok": true })
}

#[tauri::command]
pub fn window_maximize(window: WebviewWindow) -> Value {
    let is_max = window.is_maximized().unwrap_or(false);
    if is_max {
        let _ = window.unmaximize();
    } else {
        let _ = window.maximize();
    }
    json!({ "ok": true })
}

#[tauri::command]
pub fn window_close(window: WebviewWindow) -> Value {
    let _ = window.close();
    json!({ "ok": true })
}

#[tauri::command]
pub fn flush_now(app: AppHandle, state: State<'_, AppState>) -> Value {
    project::flush_renderer(&app);
    json!({ "ok": true })
}

#[tauri::command]
pub fn close_flush(app: AppHandle, state: State<'_, AppState>) -> Value {
    let raw = (*state).current_data_js();
    if let Some(obj) = crate::data::parse_data_js(&raw) {
        let json_text = serde_json::to_string(&obj).unwrap_or_default();
        (*state).save_data(&json_text);
    }
    project::update_title(&app, &*state);
    json!({ "ok": true })
}