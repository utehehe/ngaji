use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, WebviewWindowBuilder};
use tauri::WebviewUrl;
use tauri::http::{Request, Response};
use tauri::{UriSchemeContext, UriSchemeResponder};
use url::Url;

use crate::state::AppState;
use crate::protocol::{emit_event, extract_path, parse_query, serve_asset, serve_data, serve_events, serve_fonts_css, serve_invoke, serve_startup_info, serve_user_font};

mod commands;
mod kitab;
mod protocol;
mod update;
mod state;
mod project;
mod data;
mod fonts;
mod dialogs;
mod cdp;
mod perf;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            handle_second_instance(app.clone(), argv);
        }))
        // ASINKRON + thread terpisah: handler sinkron berjalan di main thread, padahal dialog native dan
        // WebView2 (CDP) perlu main thread tetap bebas -> kalau diblokir, UI membeku / deadlock.
        .register_asynchronous_uri_scheme_protocol("ngaji", move |ctx: UriSchemeContext<'_, _>, request: Request<Vec<u8>>, responder: UriSchemeResponder| {
            let app = ctx.app_handle().clone();
            thread::spawn(move || {
                let response = handle_scheme_request(&app, &request);
                responder.respond(response);
            });
        })
        .setup(|app| setup_app(app))
        .on_window_event(|window, event| handle_window_event(window, event))
        .invoke_handler(tauri::generate_handler![
            commands::data_save,
            commands::data_save_sync,
            commands::data_reset,
            commands::js_export,
            commands::dialog_alert,
            commands::dialog_confirm,
            commands::fonts_list,
            commands::fonts_add,
            commands::action_run,
            commands::app_startup,
            commands::tour_done,
            commands::kitab_list,
            commands::kitab_open,
            commands::kitab_add,
            commands::kitab_folder,
            commands::kitab_delete,
            commands::kitab_move,
            commands::titlebar_info,
            commands::titlebar_menu,
            commands::titlebar_invoke,
            commands::titlebar_colors,
            commands::zoom_in,
            commands::zoom_out,
            commands::zoom_reset,
            commands::toggle_fullscreen,
            commands::toggle_devtools,
            commands::window_minimize,
            commands::window_maximize,
            commands::window_close,
            commands::flush_now,
            commands::close_flush,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Melayani satu permintaan protokol kustom (dijalankan di thread terpisah).
fn handle_scheme_request(app: &AppHandle, request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let state = app.state::<AppState>();
    let uri = request.uri().to_string();
    let path = extract_path(&uri);

    // Pisahkan path dan query
    let (path_part, query) = path.split_once('?').unwrap_or((path.as_str(), ""));
    let q = parse_query(query);

    match path_part {
        "/" | "/index.html" => serve_asset(app, "index.html"),
        "/data/ngaji-data.js" => serve_data(&*state),
        "/fonts.css" => serve_fonts_css(&*state),
        "/__invoke" => {
            // Utama: POST {"cmd":..., "args":{...}} (UTF-8, tanpa batas panjang URL).
            // Cadangan: GET ?cmd=...&args=... (kompatibel dengan versi lama).
            let body = request.body();
            let (cmd, args) = if !body.is_empty() {
                match serde_json::from_slice::<serde_json::Value>(body) {
                    Ok(v) => (
                        v.get("cmd").and_then(|c| c.as_str()).unwrap_or("").to_owned(),
                        v.get("args").map(|a| a.to_string()).unwrap_or_default(),
                    ),
                    Err(_) => (String::new(), String::new()),
                }
            } else {
                (
                    q.get("cmd").cloned().unwrap_or_default(),
                    q.get("args").cloned().unwrap_or_default(),
                )
            };
            serve_invoke(app, &*state, &cmd, &args)
        }
        "/__events" => serve_events(),
        p if p.starts_with("/user-fonts/") => serve_user_font(&*state, &p["/user-fonts/".len()..]),
        "/startup-info.js" => serve_startup_info(&*state),
        _ => serve_asset(app, path.strip_prefix('/').unwrap_or(&path)),
    }
}

fn setup_app(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Initialize state (paths, config, directories)
    let paths = state::init_paths(app.handle())?;
    state::migrate_old_folder(&paths);

    let app_state = AppState::new(paths.clone(), env!("CARGO_PKG_VERSION").to_owned());
    app.manage(app_state);

    let state = app.state::<AppState>();

    // Start blank: clear working data so the app opens with a fresh sheet
    crate::project::start_blank(&*state);

    // Register custom protocol BEFORE creating the window
    // (done on the builder in run())

    // Create main window with custom protocol URL
    let app_handle = app.handle().clone();
    let app_url = Url::parse("ngaji://localhost/index.html").unwrap();
    let window = WebviewWindowBuilder::new(&app_handle, "main", WebviewUrl::CustomProtocol(app_url))
        .title("Ngaji")
        .inner_size(1280.0, 820.0)
        .min_inner_size(820.0, 560.0)
        .decorations(false)
        .visible(false)
        .build()?;

    let _ = window.center();
    let _ = window.maximize();

    // Show window after short delay to ensure it is ready
    let win_clone = window.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(500));
        let _ = win_clone.show();
        let _ = win_clone.set_focus();
    });

    // Background auto-update check
    let app_for_update = app_handle.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_secs(8));
        let state = app_for_update.state::<AppState>();
        let result = crate::update::check_update(&*state, false);
        if result.get("status").and_then(|v| v.as_str()) == Some("update") {
            emit_event("app:update-available", result);
        }
    });

    Ok(())
}

fn handle_second_instance(app: AppHandle, argv: Vec<String>) {
    // Focus existing window
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        if window.is_minimized().unwrap_or(false) {
            let _ = window.unminimize();
        }
    }

    // Check for .ngaji/.safinah file argument
    if let Some(file) = argv.iter().find(|a| a.ends_with(".ngaji") || a.ends_with(".safinah")) {
        let app_clone = app.clone();
        let file_clone = file.clone();
        thread::spawn(move || {
            thread::sleep(Duration::from_secs(1));
            {
                let state = app_clone.state::<AppState>();
                let mut startup = state.lock_startup();
                startup.had_open = true;
                startup.deferred = true;
            }
            let _ = crate::project::open_project_path(
                &app_clone,
                &*app_clone.state::<AppState>(),
                Some(std::path::PathBuf::from(file_clone)),
            );
        });
    }
}

fn handle_window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
    match event {
        tauri::WindowEvent::CloseRequested { .. } => {
            // Flush data before closing
            let app = window.app_handle();
            let state = app.state::<AppState>();
            let raw = state.current_data_js();
            if let Some(obj) = crate::data::parse_data_js(&raw) {
                let json_text = serde_json::to_string(&obj).unwrap_or_default();
                state.save_data(&json_text);
            }
            // Tidak memanggil window.close() lagi di sini: itu memicu CloseRequested berulang.
            // Tanpa prevent_close(), jendela otomatis tertutup setelah handler selesai.
        }
        // Focused(false) sengaja TIDAK menyimpan apa pun: renderer sudah menyimpan sendiri lewat data_save, dan membaca-ulang
        // lalu menulis-balik data.js di thread UI setiap jendela kehilangan fokus (mis. saat dialog buka/tambah muncul)
        // membuat UI tersendat dan bisa menimpa kitab yang baru saja dibuka dengan isi lama.
        _ => {}
    }
}
