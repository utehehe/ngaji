use std::time::{SystemTime, UNIX_EPOCH, Duration};

use reqwest::blocking::Client;
use serde_json::{json, Value};

use crate::state::AppState;

const GITHUB_API: &str = "https://api.github.com";
const DAY_MS: u64 = 24 * 60 * 60 * 1000;
const TIMEOUT_SEC: u64 = 10;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SemVer {
    pub major: u64,
    pub minor: u64,
    pub patch: u64,
    pub pre: Vec<String>,
}

impl SemVer {
    pub fn parse(v: &str) -> Option<Self> {
        let v = v.trim().strip_prefix('v').unwrap_or(v);
        let mut parts = v.splitn(2, '-');
        let version_part = parts.next()?;
        let pre_part = parts.next().unwrap_or("");
        let nums: Vec<&str> = version_part.split('.').collect();
        if nums.len() < 3 {
            return None;
        }
        let pre: Vec<String> = pre_part.split('.').filter(|s| !s.is_empty()).map(|s| s.to_owned()).collect();
        Some(SemVer {
            major: nums[0].parse().ok()?,
            minor: nums[1].parse().ok()?,
            patch: nums[2].parse().ok()?,
            pre,
        })
    }

    pub fn cmp(a: &SemVer, b: &SemVer) -> i8 {
        for (x, y) in [(a.major, b.major), (a.minor, b.minor), (a.patch, b.patch)] {
            if x < y { return -1; }
            if x > y { return 1; }
        }
        let a_pre_empty = a.pre.is_empty();
        let b_pre_empty = b.pre.is_empty();
        if a_pre_empty && b_pre_empty { return 0; }
        if a_pre_empty { return 1; }
        if b_pre_empty { return -1; }
        let max = a.pre.len().max(b.pre.len());
        for i in 0..max {
            match (a.pre.get(i), b.pre.get(i)) {
                (None, _) => return -1,
                (_, None) => return 1,
                (Some(p), Some(q)) => {
                    let pn = p.parse::<u64>().is_ok();
                    let qn = q.parse::<u64>().is_ok();
                    match (pn, qn) {
                        (true, true) => {
                            let pv: u64 = p.parse().unwrap_or(0);
                            let qv: u64 = q.parse().unwrap_or(0);
                            if pv < qv { return -1; }
                            if pv > qv { return 1; }
                        }
                        (true, false) => return -1,
                        (false, true) => return 1,
                        (false, false) => {
                            if p < q { return -1; }
                            if p > q { return 1; }
                        }
                    }
                }
            }
        }
        0
    }
}

fn parse_version(v: &str) -> Option<SemVer> {
    SemVer::parse(v)
}

fn compare_versions(a: &str, b: &str) -> Option<i8> {
    let x = parse_version(a)?;
    let y = parse_version(b)?;
    Some(SemVer::cmp(&x, &y))
}

pub fn should_auto_check(enabled: Option<bool>, last: Option<u64>) -> bool {
    if enabled == Some(false) {
        return false;
    }
    let t = last.unwrap_or(0);
    if t <= 0 {
        return true;
    }
    let n = now_ms_u64();
    n < t || n.saturating_sub(t) >= DAY_MS
}

pub fn now_ms_u64() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[derive(Debug, Clone)]
pub struct UpdateResult {
    pub status: String,
    pub current: String,
    pub latest: Option<String>,
    pub url: Option<String>,
    pub notes: Option<String>,
    pub error: Option<String>,
}

impl UpdateResult {
    pub fn to_value(&self) -> Value {
        let mut m = serde_json::Map::new();
        m.insert("status".into(), json!(self.status));
        m.insert("current".into(), json!(self.current));
        if let Some(l) = &self.latest { m.insert("latest".into(), json!(l)); }
        if let Some(u) = &self.url { m.insert("url".into(), json!(u)); }
        if let Some(n) = &self.notes { m.insert("notes".into(), json!(n)); }
        if let Some(e) = &self.error { m.insert("error".into(), json!(e)); }
        Value::Object(m)
    }
}

pub struct UpdateChecker {
    client: Client,
    repo_owner: String,
    repo_name: String,
}

impl UpdateChecker {
    pub fn new(owner: &str, repo: &str) -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(TIMEOUT_SEC))
                .user_agent("Ngaji")
                .build()
                .unwrap_or_else(|_| Client::new()),
            repo_owner: owner.to_owned(),
            repo_name: repo.to_owned(),
        }
    }

    pub fn check(&self, current: &str) -> UpdateResult {
        let api = format!("{GITHUB_API}/repos/{}/{}/releases/latest", self.repo_owner, self.repo_name);
        match self.client.get(&api)
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", format!("Ngaji/{current}"))
            .header("X-GitHub-Api-Version", "2022-11-28")
            .send()
        {
            Ok(res) => {
                let status = res.status().as_u16();
                if status == 404 {
                    return error_result(current, "Belum ada rilis yang dipublikasikan di GitHub.");
                }
                if status == 403 || status == 429 {
                    return error_result(current, "GitHub membatasi permintaan untuk sementara. Coba lagi nanti.");
                }
                if !res.status().is_success() {
                    return error_result(current, &format!("GitHub menjawab dengan kode {status}."));
                }
                let j: Value = match res.json() {
                    Ok(v) => v,
                    Err(_) => return error_result(current, "Data rilis tidak dapat dipakai."),
                };
                if j.get("draft").and_then(Value::as_bool) == Some(true)
                    || j.get("prerelease").and_then(Value::as_bool) == Some(true)
                {
                    return error_result(current, "Data rilis tidak dapat dipakai.");
                }
                let latest_raw = j.get("tag_name").and_then(Value::as_str).unwrap_or("");
                let latest = latest_raw.strip_prefix('v').unwrap_or(latest_raw);
                let cmp = compare_versions(latest, current);
                match cmp {
                    None => error_result_with_latest(current, Some(latest), &format!(
                        "Nomor versi rilis tidak dikenali: \"{}\".",
                        &latest_raw[..latest_raw.len().min(40)]
                    )),
                    Some(c) if c <= 0 => UpdateResult {
                        status: "current".into(),
                        current: current.to_owned(),
                        latest: Some(latest.to_owned()),
                        url: None,
                        notes: None,
                        error: None,
                    },
                    Some(_) => {
                        let base = format!("https://github.com/{}/{}/", self.repo_owner, self.repo_name);
                        let html_url = j.get("html_url").and_then(Value::as_str).unwrap_or("");
                        let url = if html_url.starts_with(&base) {
                            html_url.to_owned()
                        } else {
                            format!("{base}releases/latest")
                        };
                        let notes = j.get("body").and_then(Value::as_str)
                            .map(|s| s.trim().chars().take(1200).collect::<String>());
                        UpdateResult {
                            status: "update".into(),
                            current: current.to_owned(),
                            latest: Some(latest.to_owned()),
                            url: Some(url),
                            notes,
                            error: None,
                        }
                    }
                }
            }
            Err(e) => {
                let timed_out = e.is_timeout() || e.is_connect();
                error_result(current, &if timed_out {
                    "Waktu habis saat menghubungi GitHub."
                } else {
                    "Tidak dapat terhubung ke internet."
                })
            }
        }
    }
}

fn error_result(current: &str, msg: &str) -> UpdateResult {
    UpdateResult {
        status: "error".into(),
        current: current.to_owned(),
        latest: None,
        url: None,
        notes: None,
        error: Some(msg.to_owned()),
    }
}

fn error_result_with_latest(current: &str, latest: Option<&str>, msg: &str) -> UpdateResult {
    UpdateResult {
        status: "error".into(),
        current: current.to_owned(),
        latest: latest.map(|s| s.to_owned()),
        url: None,
        notes: None,
        error: Some(msg.to_owned()),
    }
}

/// Parse GitHub repository URL -> (owner, repo). Returns None if not GitHub or placeholder.
pub fn parse_repo(repository: Option<&Value>) -> Option<(String, String)> {
    let url = repository
        .and_then(|v| v.as_str())
        .or_else(|| repository.and_then(|v| v.get("url").and_then(Value::as_str)))
        .unwrap_or("");
    let url = url.trim().strip_prefix("git+").unwrap_or(url);
    let url = url.strip_suffix(".git").unwrap_or(url);
    if !url.starts_with("https://github.com/") {
        return None;
    }
    let rest = &url["https://github.com/".len()..];
    let parts: Vec<&str> = rest.split('/').collect();
    if parts.len() < 2 {
        return None;
    }
    let owner = parts[0];
    let repo = parts[1];
    if owner.is_empty() || repo.is_empty() {
        return None;
    }
    if owner.to_uppercase().starts_with("GANTI") || repo.to_uppercase().starts_with("GANTI") {
        return None;
    }
    Some((owner.to_owned(), repo.to_owned()))
}

pub fn check_update(state: &AppState, manual: bool) -> Value {
    let cfg = state.read_config();
    let auto_enabled = cfg.get("autoCheckUpdates").and_then(Value::as_bool).unwrap_or(true);
    let last_check = cfg.get("lastUpdateCheck").and_then(Value::as_u64);

    if !manual && !should_auto_check(Some(auto_enabled), last_check) {
        return json!({ "status": "skipped" });
    }

    let repo = parse_repo(cfg.get("repository").or_else(|| cfg.get("repo")));
    let (owner, repo_name) = match repo {
        Some(r) => r,
        None => {
            if manual {
                return json!({
                    "status": "disabled",
                    "current": env!("CARGO_PKG_VERSION"),
                    "error": "Pemeriksaan pembaruan belum diaktifkan. Isi kolom repository di package.json."
                });
            }
            return json!({ "status": "disabled" });
        }
    };

    let checker = UpdateChecker::new(&owner, &repo_name);
    let current = env!("CARGO_PKG_VERSION");
    let result = checker.check(current);

    // Update last check timestamp in config (caller should persist)
    let mut cfg = cfg.clone();
    if let Some(obj) = cfg.as_object_mut() {
        obj.insert("lastUpdateCheck".into(), json!(now_ms_u64()));
    }

    if result.status == "update" {
        let skip = cfg.get("skipVersion").and_then(Value::as_str);
        if !manual && skip == result.latest.as_deref() {
            return json!({ "status": "skipped" });
        }
    }

    result.to_value()
}

pub fn set_skip_version(state: &AppState, version: &str) {
    let mut cfg = state.read_config();
    if let Some(obj) = cfg.as_object_mut() {
        obj.insert("skipVersion".into(), json!(version));
    }
    state.write_config(&cfg);
}
