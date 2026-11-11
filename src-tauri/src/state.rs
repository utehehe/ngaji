use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};

use chrono::Utc;
use serde_json::{json, Value};
use sha1::{Digest, Sha1};
use tauri::{AppHandle, Manager};

use crate::data;

pub const APP_NAME: &str = "Ngaji";
pub const TITLE: &str = "Ngaji";
pub const CUSTOM_TB: bool = true;
pub const TB_H: f64 = 34.0;
pub const DEFAULT_DATA: &str = include_str!("../../app/data/ngaji-data.js");
pub const MAX_FONT_BYTES: u64 = 40 * 1024 * 1024;
pub const COMPACT_ABOVE: usize = 4 * 1024 * 1024;

#[derive(Debug, Clone)]
pub struct Paths {
    pub data_dir: PathBuf,
    pub data: PathBuf,
    pub config: PathBuf,
    pub backups: PathBuf,
    pub fonts: PathBuf,
    pub user_kitab: PathBuf,
    pub app_fonts: PathBuf,
}

#[derive(Debug, Clone, Default)]
pub struct StartupState {
    pub had_open: bool,
    pub deferred: bool,
    pub done: bool,
    pub reveal: bool,
    pub pending_toast: Option<String>,
}

/// Keputusan awal untuk SATU pemuatan halaman.
#[derive(Debug, Clone)]
pub struct StartupSnapshot {
    pub intro: bool,
    pub launcher: bool,
    pub reveal: bool,
    pub had_open: bool,
    pub deferred: bool,
    pub pending_toast: Option<String>,
}

impl StartupState {
    /// Ambil keputusan untuk pemuatan halaman ini, lalu tandai bahwa hal-hal sekali-pakai sudah dipakai:
    /// animasi pembuka & jendela pilih kitab hanya untuk pemuatan PERTAMA setelah aplikasi dibuka;
    /// `reveal` dan toast hanya berlaku untuk satu muat ulang. Tanpa ini intro berulang di setiap muat ulang.
    pub fn take_for_page(&mut self) -> StartupSnapshot {
        let snap = StartupSnapshot {
            intro: !self.done,
            launcher: !self.had_open && !self.deferred,
            reveal: self.reveal,
            had_open: self.had_open,
            deferred: self.deferred,
            pending_toast: self.pending_toast.take(),
        };
        self.done = true;
        self.had_open = true;
        self.deferred = false;
        self.reveal = false;
        snap
    }
}

pub struct AppState {
    pub paths: Paths,
    pub startup: Mutex<StartupState>,
    pub kitab_cache: Mutex<HashMap<PathBuf, KitabCacheEntry>>,
    pub font_meta_cache: Mutex<HashMap<String, data::FontMeta>>,
    pub default_backed_up: AtomicBool,
    pub default_hash_cache: Mutex<Option<String>>,
    pub valid_data_stamp: Mutex<Option<String>>,
    pub save_epoch: AtomicU64,
    pub latest_sync_epoch: AtomicU64,
    pub save_lock: Mutex<()>,
    pub title_generation: AtomicU64,
    pub zoom: Mutex<f64>,
    pub closing: AtomicBool,
    pub update_checking: AtomicBool,
    pub app_version: String,
}

#[derive(Debug, Clone)]
pub struct KitabCacheEntry {
    pub stamp: String,
    pub file_jenis: String,
    pub info: Value,
}

impl AppState {
    pub fn new(paths: Paths, app_version: String) -> Self {
        Self {
            paths,
            startup: Mutex::new(StartupState::default()),
            kitab_cache: Mutex::new(HashMap::new()),
            font_meta_cache: Mutex::new(HashMap::new()),
            default_backed_up: AtomicBool::new(false),
            default_hash_cache: Mutex::new(None),
            valid_data_stamp: Mutex::new(None),
            save_lock: Mutex::new(()),
            save_epoch: AtomicU64::new(0),
            latest_sync_epoch: AtomicU64::new(0),
            title_generation: AtomicU64::new(0),
            zoom: Mutex::new(1.0),
            closing: AtomicBool::new(false),
            update_checking: AtomicBool::new(false),
            app_version,
        }
    }

    pub fn lock_startup(&self) -> MutexGuard<'_, StartupState> {
        self.startup.lock().unwrap_or_else(|e| e.into_inner())
    }

    pub fn read_config(&self) -> Value {
        let text = read_if_exists(&self.paths.config).unwrap_or_default();
        serde_json::from_str::<Value>(&text)
            .ok()
            .filter(|v| v.is_object())
            .unwrap_or_else(|| json!({}))
    }

    pub fn write_config(&self, cfg: &Value) {
        if let Ok(text) = serde_json::to_string_pretty(cfg) {
            let _ = write_atomic(&self.paths.config, text.as_bytes());
        }
    }

    pub fn config_str(&self, key: &str) -> Option<String> {
        self.read_config()
            .get(key)
            .and_then(Value::as_str)
            .map(str::to_owned)
    }

    pub fn config_bool(&self, key: &str) -> Option<bool> {
        self.read_config().get(key).and_then(Value::as_bool)
    }

    pub fn config_i64(&self, key: &str) -> Option<i64> {
        self.read_config().get(key).and_then(Value::as_i64)
    }

    pub fn set_config(&self, key: &str, value: Value) {
        let mut cfg = self.read_config();
        if let Some(obj) = cfg.as_object_mut() {
            obj.insert(key.to_owned(), value);
        }
        self.write_config(&cfg);
    }

    pub fn remove_config(&self, key: &str) {
        let mut cfg = self.read_config();
        if let Some(obj) = cfg.as_object_mut() {
            obj.remove(key);
        }
        self.write_config(&cfg);
    }

    pub fn backup_content(&self, prefix: &str, content: &str) {
        let _ = fs::create_dir_all(&self.paths.backups);
        let hash = sha1_hex(content.as_bytes());
        let short = &hash[..10.min(hash.len())];
        let entries = match fs::read_dir(&self.paths.backups) {
            Ok(rd) => rd,
            Err(_) => return,
        };
        let names: Vec<String> = entries
            .flatten()
            .filter_map(|e| e.file_name().into_string().ok())
            .collect();
        if names.iter().any(|n| n.contains(short)) {
            return;
        }
        let stamp = Utc::now().format("%Y-%m-%dT%H-%M-%S-%3fZ").to_string();
        let file = self
            .paths
            .backups
            .join(format!("{prefix}-{stamp}-{short}.js"));
        let _ = fs::write(file, content);
        let mut rotating: Vec<String> = names
            .into_iter()
            .filter(|n| n.starts_with("data-"))
            .collect();
        rotating.sort();
        while rotating.len() > 30 {
            if let Some(old) = rotating.first() {
                let _ = fs::remove_file(self.paths.backups.join(old));
                rotating.remove(0);
            }
        }
    }

    pub fn backup_current_data(&self) {
        if let Some(raw) = read_if_exists(&self.paths.data) {
            self.backup_content("data", &raw);
        }
    }

    /// Data .js served to the page: user data when valid, otherwise the embedded default.
    pub fn current_data_js(&self) -> String {
        if !self.default_backed_up.swap(true, Ordering::SeqCst) {
            self.backup_content("embedded", DEFAULT_DATA);
        }

        if let Some(raw) = read_if_exists(&self.paths.data) {
            let stamp = fs::metadata(&self.paths.data)
                .ok()
                .map(|m| format!("{}:{}", m.len(), mtime_ms(&m)))
                .unwrap_or_default();
            if !stamp.is_empty() {
                let cached = self
                    .valid_data_stamp
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .clone();
                if cached.as_deref() == Some(stamp.as_str())
                    && data::has_ngaji_assignment(&raw)
                {
                    return raw;
                }
            }
            if let Some(obj) = data::parse_data_js(&raw) {
                self.backup_content("data", &raw);
                if data::has_ngaji_assignment(&raw) {
                    *self
                        .valid_data_stamp
                        .lock()
                        .unwrap_or_else(|e| e.into_inner()) = Some(stamp);
                    return raw;
                }
                return data::compose_data_js(&obj, false);
            }
            let broken = self.paths.data.with_file_name(format!(
                "{}.rusak-{}",
                self.paths
                    .data
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("ngaji-data.js"),
                now_ms()
            ));
            let _ = fs::rename(&self.paths.data, broken);
        }
        DEFAULT_DATA.to_owned()
    }

    pub fn default_hash(&self) -> String {
        let mut cache = self
            .default_hash_cache
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        if let Some(h) = cache.as_ref() {
            return h.clone();
        }
        let hash = data::parse_data_js(DEFAULT_DATA)
            .and_then(|obj| data::normalize(obj).ok())
            .map(|obj| content_hash(&obj))
            .unwrap_or_else(|| sha1_hex(DEFAULT_DATA.as_bytes()));
        *cache = Some(hash.clone());
        hash
    }

    pub fn working_hash(&self) -> String {
        match read_if_exists(&self.paths.data) {
            Some(raw) => match data::parse_data_js(&raw) {
                Some(obj) => content_hash(&obj),
                None => sha1_hex(raw.as_bytes()),
            },
            None => self.default_hash(),
        }
    }

    pub fn is_empty_unsaved(&self) -> bool {
        if self.config_str("projectPath").is_some() {
            return false;
        }
        let raw = read_if_exists(&self.paths.data).unwrap_or_default();
        match data::parse_data_js(&raw) {
            Some(obj) => obj
                .get("pages")
                .and_then(Value::as_array)
                .map(|pages| {
                    pages.iter().all(|p| {
                        p.get("sentences")
                            .and_then(Value::as_array)
                            .map(|s| s.is_empty())
                            .unwrap_or(true)
                    })
                })
                .unwrap_or(false),
            None => false,
        }
    }

    pub fn project_dirty(&self) -> bool {
        if self.is_empty_unsaved() {
            return false;
        }
        let saved = self
            .config_str("projectHash")
            .unwrap_or_else(|| self.default_hash());
        self.working_hash() != saved
    }

    pub fn project_name(&self) -> String {
        if let Some(path) = self.config_str("projectPath") {
            return Path::new(&path)
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("Tanpa Judul")
                .to_owned();
        }
        self.config_str("bundledName")
            .unwrap_or_else(|| "Tanpa Judul".to_owned())
    }

    pub fn working_content(&self, obj: &Value, json_len: usize) -> String {
        data::compose_data_js(obj, json_len > COMPACT_ABOVE)
    }

    pub fn save_data(&self, json_text: &str) -> Value {
        let mine = self.save_epoch.fetch_add(1, Ordering::SeqCst) + 1;
        self.latest_sync_epoch.store(mine, Ordering::SeqCst);
        let _guard = self.save_lock.lock().unwrap_or_else(|e| e.into_inner());
        let result = (|| -> Result<(), String> {
            let value: Value =
                serde_json::from_str(json_text).map_err(|e| format!("JSON tidak valid: {e}"))?;
            let obj = data::normalize(value)?;
            let content = self.working_content(&obj, json_text.len());
            write_atomic(&self.paths.data, content.as_bytes()).map_err(|e| e.to_string())
        })();
        match result {
            Ok(()) => json!({ "ok": true }),
            Err(e) => json!({ "ok": false, "error": e }),
        }
    }

    pub fn save_data_async(&self, json_text: &str) -> Value {
        let mine = self.save_epoch.fetch_add(1, Ordering::SeqCst) + 1;
        let _guard = self.save_lock.lock().unwrap_or_else(|e| e.into_inner());
        if mine < self.latest_sync_epoch.load(Ordering::SeqCst) {
            return json!({ "ok": true, "skipped": true });
        }
        let result = (|| -> Result<(), String> {
            let value: Value =
                serde_json::from_str(json_text).map_err(|e| format!("JSON tidak valid: {e}"))?;
            let obj = data::normalize(value)?;
            let content = self.working_content(&obj, json_text.len());
            write_atomic(&self.paths.data, content.as_bytes()).map_err(|e| e.to_string())
        })();
        match result {
            Ok(()) => json!({ "ok": true }),
            Err(e) => json!({ "ok": false, "error": e }),
        }
    }

    pub fn reset_data(&self) {
        self.backup_current_data();
        let _ = fs::remove_file(&self.paths.data);
        let mut cfg = self.read_config();
        if let Some(obj) = cfg.as_object_mut() {
            obj.remove("projectPath");
            obj.remove("projectHash");
        }
        self.write_config(&cfg);
    }
}

pub fn init_paths(app: &AppHandle) -> Result<Paths, Box<dyn std::error::Error>> {
    let data_dir = app.path().app_data_dir()?;
    let paths = Paths {
        data: data_dir.join("ngaji-data.js"),
        config: data_dir.join("config.json"),
        backups: data_dir.join("backups"),
        fonts: data_dir.join("fonts"),
        user_kitab: data_dir.join("kitab"),
        app_fonts: app_assets_dir().join("fonts"),
        data_dir,
    };
    fs::create_dir_all(&paths.backups)?;
    fs::create_dir_all(&paths.fonts)?;
    fs::create_dir_all(&paths.user_kitab)?;
    Ok(paths)
}

pub fn app_assets_dir() -> PathBuf {
    if cfg!(debug_assertions) {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("app")
    } else {
        // The frontend assets are embedded in the executable. This path is only
        // used for optional loose font files next to the executable.
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(Path::to_path_buf))
            .unwrap_or_else(|| PathBuf::from("."))
            .join("app")
    }
}

pub fn bundled_kitab_dir(app: &AppHandle) -> PathBuf {
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("kitab");
    if dev.is_dir() {
        return dev;
    }
    app.path()
        .resource_dir()
        .map(|d| d.join("kitab"))
        .unwrap_or_else(|_| dev)
}

pub fn migrate_old_folder(paths: &Paths) {
    if paths.data.exists() {
        return;
    }
    let Some(parent) = paths.data_dir.parent() else {
        return;
    };
    let candidates = [
        parent.join("ngaji"),
        parent.join("safinatunnajah-reader"),
    ];
    for old in candidates {
        if old == paths.data_dir || !old.is_dir() {
            continue;
        }
        let candidates_data = [old.join("ngaji-data.js"), old.join("safinah-data.js")];
        for file in candidates_data {
            let Some(raw) = read_if_exists(&file) else {
                continue;
            };
            let Some(obj) = data::parse_data_js(&raw) else {
                continue;
            };
            let Ok(obj) = data::normalize(obj) else {
                continue;
            };
            let content = data::compose_data_js(&obj, false);
            let _ = write_atomic(&paths.data, content.as_bytes());

            let mut cfg = json!({});
            if let Some(old_cfg) = read_if_exists(&old.join("config.json"))
                .and_then(|s| serde_json::from_str::<Value>(&s).ok())
            {
                if let Some(p) = old_cfg.get("projectPath").and_then(Value::as_str) {
                    if let Some(o) = cfg.as_object_mut() {
                        o.insert("projectPath".into(), json!(p));
                    }
                    if old_cfg.get("projectHash").and_then(Value::as_str) == Some(&sha1_hex(raw.as_bytes())) {
                        if let Some(o) = cfg.as_object_mut() {
                            o.insert("projectHash".into(), json!(sha1_hex(content.as_bytes())));
                        }
                    }
                }
            }
            if let Ok(text) = serde_json::to_string_pretty(&cfg) {
                let _ = write_atomic(&paths.config, text.as_bytes());
            }

            let old_fonts = old.join("fonts");
            if let Ok(rd) = fs::read_dir(old_fonts) {
                let _ = fs::create_dir_all(&paths.fonts);
                for entry in rd.flatten() {
                    if entry.path().is_file() {
                        let dest = paths.fonts.join(entry.file_name());
                        let _ = fs::copy(entry.path(), dest);
                    }
                }
            }
            return;
        }
    }
}

pub fn read_if_exists(path: &Path) -> Option<String> {
    fs::read_to_string(path).ok()
}

pub fn write_atomic(path: &Path, content: &[u8]) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let tmp = path.with_file_name(format!(
        "{}.{}.tmp",
        path.file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("ngaji"),
        std::process::id()
    ));
    {
        let mut file = fs::File::create(&tmp)?;
        file.write_all(content)?;
        file.flush()?;
    }
    match fs::rename(&tmp, path) {
        Ok(()) => Ok(()),
        Err(_) => {
            let _ = fs::remove_file(&tmp);
            let tmp2 = path.with_file_name(format!(
                "{}.{}.{}.tmp",
                path.file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("ngaji"),
                std::process::id(),
                now_ms()
            ));
            {
                let mut file = fs::File::create(&tmp2)?;
                file.write_all(content)?;
                file.flush()?;
            }
            fs::rename(&tmp2, path)
        }
    }
}

/// Bentuk kanonik untuk membandingkan ISI kitab: kunci diurutkan, nilai "kosong" (null, false, "", [], {}) dibuang
/// supaya `bold:false`, `align:null`, `keterangan_kalimat:{catatan:""}` yang ditambahkan renderer saat memuat
/// tidak dianggap perubahan.
fn canon(v: &Value) -> Option<String> {
    match v {
        Value::Null | Value::Bool(false) => None,
        Value::String(s) if s.is_empty() => None,
        Value::Object(m) => {
            let mut items: Vec<(&String, String)> =
                m.iter().filter_map(|(k, v)| canon(v).map(|c| (k, c))).collect();
            if items.is_empty() {
                return None;
            }
            items.sort_by(|a, b| a.0.cmp(b.0));
            let body: Vec<String> = items.into_iter().map(|(k, c)| format!("{k:?}:{c}")).collect();
            Some(format!("{{{}}}", body.join(",")))
        }
        Value::Array(a) => {
            if a.is_empty() {
                return None;
            }
            let body: Vec<String> = a.iter().map(|x| canon(x).unwrap_or_else(|| "0".to_owned())).collect();
            Some(format!("[{}]", body.join(",")))
        }
        other => Some(other.to_string()),
    }
}

/// Hash ISI kitab untuk deteksi "ada perubahan yang belum disimpan". Mengabaikan `settings`, `progress`, dan `dev`
/// (pengaturan tampilan / posisi baca berubah otomatis dan bukan perubahan isi kitab).
pub fn content_hash(obj: &Value) -> String {
    let mut parts: Vec<(&String, String)> = Vec::new();
    if let Some(m) = obj.as_object() {
        for (k, v) in m {
            if matches!(k.as_str(), "settings" | "progress" | "dev") {
                continue;
            }
            if let Some(c) = canon(v) {
                parts.push((k, c));
            }
        }
    }
    parts.sort_by(|a, b| a.0.cmp(b.0));
    let text: Vec<String> = parts.into_iter().map(|(k, c)| format!("{k:?}:{c}")).collect();
    sha1_hex(text.join(",").as_bytes())
}

pub fn sha1_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha1::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

pub fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

pub fn mtime_ms(meta: &fs::Metadata) -> u128 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

pub fn iso_now() -> String {
    Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

/// Nama berkas aman untuk Windows / macOS / Linux.
pub fn safe_file_name(text: &str) -> String {
    let mut out = String::new();
    for ch in text.chars() {
        if matches!(
            ch,
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\u{0000}'..='\u{001f}'
        ) {
            out.push('_');
        } else {
            out.push(ch);
        }
    }
    let trimmed = out.trim();
    if trimmed.is_empty() {
        "proyek".to_owned()
    } else {
        trimmed.chars().take(80).collect()
    }
}

pub fn clean_name(text: &str, fallback: &str) -> String {
    let mut s = String::new();
    for ch in text.chars() {
        if matches!(
            ch,
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\u{0000}'..='\u{001f}'
        ) {
            s.push(' ');
        } else {
            s.push(ch);
        }
    }
    let s = s.split_whitespace().collect::<Vec<_>>().join(" ");
    let s = s.trim_start_matches('.').trim();
    let out: String = s.chars().take(80).collect();
    if out.trim().is_empty() {
        fallback.to_owned()
    } else {
        out.trim().to_owned()
    }
}
