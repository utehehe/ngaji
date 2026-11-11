use std::collections::HashSet;

use serde::Serialize;
use serde_json::ser::{PrettyFormatter, Serializer};
use serde_json::{json, Map, Value};

pub const PROJECT_FORMAT: &str = "ngaji-project";
pub const LEGACY_PROJECT_FORMAT: &str = "safinatunnajah-project";
pub const PROJECT_VERSION: i64 = 1;
pub const PROJECT_EXT: &str = "ngaji";

const HEADER: &str = "/* Data Ngaji — dibuat otomatis oleh aplikasi.\n   Boleh diedit manual; pastikan isinya tetap objek JavaScript yang valid. */\n";

pub fn has_ngaji_assignment(src: &str) -> bool {
    assignment_index(src).is_some()
}

fn assignment_index(src: &str) -> Option<usize> {
    let mut best: Option<usize> = None;
    for marker in ["window.NGAJI_DATA", "window.SAFINAH_DATA"] {
        if let Some(idx) = src.find(marker) {
            let after = &src[idx + marker.len()..];
            let mut chars = after.char_indices();
            let mut is_assignment = false;
            for (_, ch) in chars.by_ref() {
                if ch.is_whitespace() {
                    continue;
                }
                is_assignment = ch == '=';
                break;
            }
            if is_assignment {
                best = Some(match best {
                    Some(b) if b < idx => b,
                    _ => idx,
                });
            }
        }
    }
    best
}

/// Baca teks file .js -> objek data (None bila tidak ditemukan / rusak).
pub fn parse_data_js(src: &str) -> Option<Value> {
    let idx = assignment_index(src)?;
    let rest = &src[idx..];
    let value_start = rest.find('=')? + 1;
    let rest = &rest[value_start..];
    let start = rest.find('{')?;
    let end = rest.rfind('}')?;
    if end < start {
        return None;
    }
    let slice = &rest[start..=end];
    serde_json::from_str::<Value>(slice)
        .ok()
        .or_else(|| json5::from_str::<Value>(slice).ok())
}

/// compact = true: tanpa indentasi (dipakai untuk buku besar pada autosave).
pub fn compose_data_js(obj: &Value, compact: bool) -> String {
    let body = if compact {
        serde_json::to_string(obj).unwrap_or_else(|_| "null".to_owned())
    } else {
        let mut buf = Vec::new();
        let formatter = PrettyFormatter::with_indent(b" ");
        let mut ser = Serializer::with_formatter(&mut buf, formatter);
        if obj.serialize(&mut ser).is_err() {
            "null".to_owned()
        } else {
            String::from_utf8(buf).unwrap_or_else(|_| "null".to_owned())
        }
    };
    format!("{HEADER}window.NGAJI_DATA = {body};\n")
}

fn ensure_object(value: &mut Value) -> &mut Map<String, Value> {
    if !value.is_object() {
        *value = json!({});
    }
    value.as_object_mut().expect("just made an object")
}

fn ensure_array(value: &mut Value) -> &mut Vec<Value> {
    if !value.is_array() {
        *value = json!([]);
    }
    value.as_array_mut().expect("just made an array")
}

fn is_color(value: &str) -> bool {
    let Some(rest) = value.strip_prefix('#') else {
        return false;
    };
    (3..=8).contains(&rest.len()) && rest.bytes().all(|b| b.is_ascii_hexdigit())
}

fn as_nonempty_string(value: &Value) -> Option<String> {
    value
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
}

/// Validasi + lengkapi bidang yang hilang. Err berisi pesan Indonesia.
pub fn normalize(obj: Value) -> Result<Value, String> {
    let mut obj = obj;
    if !obj.is_object() || obj.is_array() {
        return Err("Data bukan objek.".to_owned());
    }
    let root = obj.as_object_mut().expect("checked object");
    let pages_ok = root
        .get("pages")
        .and_then(Value::as_array)
        .map(|a| !a.is_empty())
        .unwrap_or(false);
    if !pages_ok {
        return Err("Kunci \"pages\" (daftar halaman) tidak ditemukan.".to_owned());
    }
    if !root.get("title").map(Value::is_string).unwrap_or(false) {
        root.insert("title".into(), json!("Ngaji"));
    }
    if !root.get("settings").map(Value::is_object).unwrap_or(false) {
        root.insert("settings".into(), json!({}));
    }

    {
        let pages = root
            .get_mut("pages")
            .and_then(Value::as_array_mut)
            .expect("checked pages");
        for (pi, page) in pages.iter_mut().enumerate() {
            let p = page
                .as_object_mut()
                .ok_or_else(|| format!("Halaman {} tidak valid.", pi + 1))?;
            if !p.get("id").map(Value::is_string).unwrap_or(false)
                || p.get("id").and_then(Value::as_str).unwrap_or("").is_empty()
            {
                p.insert("id".into(), json!(format!("p-{}", pi + 1)));
            }
            if !p.get("title").map(Value::is_string).unwrap_or(false) {
                p.insert("title".into(), json!(format!("Halaman {}", pi + 1)));
            }
            if !p.get("sentences").map(Value::is_array).unwrap_or(false) {
                p.insert("sentences".into(), json!([]));
            }
            let page_id = p
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_owned();
            let sentences = p
                .get_mut("sentences")
                .and_then(Value::as_array_mut)
                .expect("ensured sentences");
            for (si, sentence) in sentences.iter_mut().enumerate() {
                let s = sentence
                    .as_object_mut()
                    .ok_or_else(|| format!("Kalimat {} pada halaman {} tidak valid.", si + 1, pi + 1))?;
                if !s.get("id").map(Value::is_string).unwrap_or(false)
                    || s.get("id").and_then(Value::as_str).unwrap_or("").is_empty()
                {
                    s.insert("id".into(), json!(format!("{page_id}-s{}", si + 1)));
                }
                if !s.get("words").map(Value::is_array).unwrap_or(false) {
                    s.insert("words".into(), json!([]));
                }
                if !s
                    .get("type")
                    .and_then(Value::as_str)
                    .map(|t| matches!(t, "text" | "heading" | "sub"))
                    .unwrap_or(false)
                {
                    s.insert("type".into(), json!("text"));
                }
                if !s
                    .get("align")
                    .and_then(Value::as_str)
                    .map(|t| matches!(t, "right" | "center" | "left" | "justify"))
                    .unwrap_or(false)
                {
                    s.insert("align".into(), Value::Null);
                }
                s.insert(
                    "bold".into(),
                    json!(s.get("bold").and_then(Value::as_bool).unwrap_or(false)),
                );
                let color_ok = s
                    .get("color")
                    .and_then(Value::as_str)
                    .map(is_color)
                    .unwrap_or(false);
                if !color_ok {
                    s.remove("color");
                }
                let catatan = s
                    .get("keterangan_kalimat")
                    .and_then(Value::as_object)
                    .and_then(|k| k.get("catatan"))
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_owned();
                s.insert(
                    "keterangan_kalimat".into(),
                    json!({ "catatan": catatan }),
                );

                let sentence_id = s
                    .get("id")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_owned();
                let words = s
                    .get_mut("words")
                    .and_then(Value::as_array_mut)
                    .expect("ensured words");
                for (wi, word) in words.iter_mut().enumerate() {
                    let w = word.as_object_mut().ok_or_else(|| {
                        format!(
                            "Kata {} pada kalimat {} halaman {} tidak valid.",
                            wi + 1,
                            si + 1,
                            pi + 1
                        )
                    })?;
                    if !w.get("id").map(Value::is_string).unwrap_or(false)
                        || w.get("id").and_then(Value::as_str).unwrap_or("").is_empty()
                    {
                        w.insert("id".into(), json!(format!("{sentence_id}-w{}", wi + 1)));
                    }
                    if !w.get("arab").map(Value::is_string).unwrap_or(false) {
                        w.insert("arab".into(), json!(""));
                    }
                    if !w.get("pegon").map(Value::is_string).unwrap_or(false) {
                        w.insert("pegon".into(), json!(""));
                    }
                    let color_ok = w
                        .get("color")
                        .and_then(Value::as_str)
                        .map(is_color)
                        .unwrap_or(false);
                    if !color_ok {
                        w.remove("color");
                    }
                    let nahwu = w
                        .get("nahwu")
                        .and_then(Value::as_str)
                        .map(str::to_owned)
                        .unwrap_or_default();
                    if nahwu.is_empty() {
                        w.remove("nahwu");
                        w.remove("nahwuLabel");
                    } else {
                        let label = w
                            .get("nahwuLabel")
                            .and_then(Value::as_str)
                            .map(str::trim)
                            .filter(|s| !s.is_empty())
                            .map(|s| s.chars().take(24).collect::<String>());
                        if let Some(label) = label {
                            w.insert("nahwuLabel".into(), json!(label));
                        } else {
                            w.remove("nahwuLabel");
                        }
                    }

                    let mut ids: Vec<String> = match w.get("dhomir_target_ids") {
                        Some(Value::Array(arr)) => arr
                            .iter()
                            .filter_map(Value::as_str)
                            .filter(|s| !s.is_empty())
                            .map(str::to_owned)
                            .collect(),
                        _ => w
                            .get("dhomir_target_id")
                            .and_then(Value::as_str)
                            .filter(|s| !s.is_empty())
                            .map(|s| vec![s.to_owned()])
                            .unwrap_or_default(),
                    };
                    ids.dedup();
                    let first = ids.first().cloned();
                    w.insert("dhomir_target_ids".into(), json!(ids));
                    w.insert(
                        "dhomir_target_id".into(),
                        first.map(Value::String).unwrap_or(Value::Null),
                    );

                    let mut letters: Vec<i64> = match w.get("dhomir_letters") {
                        Some(Value::Array(arr)) => arr
                            .iter()
                            .filter_map(Value::as_i64)
                            .filter(|n| *n >= 0)
                            .collect(),
                        _ => Vec::new(),
                    };
                    letters.sort_unstable();
                    letters.dedup();
                    w.insert("dhomir_letters".into(), json!(letters));
                }

                let word_ids: HashSet<String> = s
                    .get("words")
                    .and_then(Value::as_array)
                    .map(|words| {
                        words
                            .iter()
                            .filter_map(|w| w.get("id").and_then(Value::as_str))
                            .map(str::to_owned)
                            .collect()
                    })
                    .unwrap_or_default();

                if let Some(rentang) = s.get("rentang").cloned() {
                    let mut out = Vec::new();
                    if let Some(list) = rentang.as_array() {
                        for (ri, r) in list.iter().enumerate() {
                            let Some(ro) = r.as_object() else { continue };
                            let dari = ro.get("dari").and_then(Value::as_str).unwrap_or("");
                            let sampai = ro.get("sampai").and_then(Value::as_str).unwrap_or("");
                            if !word_ids.contains(dari) || !word_ids.contains(sampai) {
                                continue;
                            }
                            let mut item = Map::new();
                            item.insert(
                                "id".into(),
                                json!(ro
                                    .get("id")
                                    .and_then(Value::as_str)
                                    .filter(|x| !x.is_empty())
                                    .map(str::to_owned)
                                    .unwrap_or_else(|| format!("{sentence_id}-r{}", ri + 1))),
                            );
                            item.insert("dari".into(), json!(dari));
                            item.insert("sampai".into(), json!(sampai));
                            item.insert(
                                "catatan".into(),
                                json!(ro.get("catatan").and_then(Value::as_str).unwrap_or("")),
                            );
                            if let Some(warna) = ro.get("warna").and_then(Value::as_str) {
                                if is_color(warna) {
                                    item.insert("warna".into(), json!(warna));
                                }
                            }
                            out.push(Value::Object(item));
                        }
                    }
                    if out.is_empty() {
                        s.remove("rentang");
                    } else {
                        s.insert("rentang".into(), Value::Array(out));
                    }
                }

                if let Some(frasa) = s.get("frasa").cloned() {
                    let mut out = Vec::new();
                    if let Some(list) = frasa.as_array() {
                        for (fi, f) in list.iter().enumerate() {
                            let Some(fo) = f.as_object() else { continue };
                            let dari = fo.get("dari").and_then(Value::as_str).unwrap_or("");
                            let sampai = fo.get("sampai").and_then(Value::as_str).unwrap_or("");
                            if !word_ids.contains(dari) || !word_ids.contains(sampai) {
                                continue;
                            }
                            let mut item = Map::new();
                            item.insert(
                                "id".into(),
                                json!(fo
                                    .get("id")
                                    .and_then(Value::as_str)
                                    .filter(|x| !x.is_empty())
                                    .map(str::to_owned)
                                    .unwrap_or_else(|| format!("{sentence_id}-f{}", fi + 1))),
                            );
                            item.insert("dari".into(), json!(dari));
                            item.insert("sampai".into(), json!(sampai));
                            item.insert(
                                "pegon".into(),
                                json!(fo.get("pegon").and_then(Value::as_str).unwrap_or("")),
                            );
                            out.push(Value::Object(item));
                        }
                    }
                    if out.is_empty() {
                        s.remove("frasa");
                    } else {
                        s.insert("frasa".into(), Value::Array(out));
                    }
                }
            }
        }
    }

    if root.get("progress").is_some() {
        let mut keys: HashSet<String> = HashSet::new();
        let mut page_ids: HashSet<String> = HashSet::new();
        if let Some(pages) = root.get("pages").and_then(Value::as_array) {
            for p in pages {
                if let Some(id) = p.get("id").and_then(Value::as_str) {
                    keys.insert(id.to_owned());
                    page_ids.insert(id.to_owned());
                }
                if let Some(sentences) = p.get("sentences").and_then(Value::as_array) {
                    for s in sentences {
                        if s.get("type").and_then(Value::as_str) == Some("sub") {
                            if let Some(id) = s.get("id").and_then(Value::as_str) {
                                keys.insert(id.to_owned());
                            }
                        }
                    }
                }
            }
        }
        let pr = root.get("progress").cloned().unwrap_or(Value::Null);
        let mut out = Map::new();
        if let Some(done) = pr.get("done").and_then(Value::as_object) {
            let mut kept = Map::new();
            for (k, v) in done {
                if v.as_bool() == Some(true) && keys.contains(k) {
                    kept.insert(k.clone(), json!(true));
                }
            }
            if !kept.is_empty() {
                out.insert("done".into(), Value::Object(kept));
            }
        }
        if let Some(last) = pr.get("last") {
            if let Some(p) = last.get("p").and_then(Value::as_str) {
                if page_ids.contains(p) {
                    let s = last
                        .get("s")
                        .and_then(Value::as_str)
                        .filter(|s| !s.is_empty());
                    out.insert(
                        "last".into(),
                        json!({ "p": p, "s": s.map(|s| Value::String(s.to_owned())).unwrap_or(Value::Null) }),
                    );
                }
            }
        }
        if out.is_empty() {
            root.remove("progress");
        } else {
            if !out.contains_key("done") {
                out.insert("done".into(), json!({}));
            }
            root.insert("progress".into(), Value::Object(out));
        }
    }

    Ok(obj)
}

pub fn looks_like_project(src: &str) -> bool {
    let head: String = src.chars().take(2000).collect();
    (head.contains("\"format\"")
        && (head.contains("\"ngaji-project\"") || head.contains("\"safinatunnajah-project\"")))
}

/// fonts: [{ name, family, sha1, data(base64) }]
pub fn compose_project(obj: &Value, fonts: &[Value], app_version: &str) -> String {
    let body = json!({
        "format": PROJECT_FORMAT,
        "version": PROJECT_VERSION,
        "app": app_version,
        "savedAt": crate::state::iso_now(),
        "data": obj,
        "fonts": fonts,
    });
    let mut buf = Vec::new();
    let formatter = PrettyFormatter::with_indent(b" ");
    let mut ser = Serializer::with_formatter(&mut buf, formatter);
    if body.serialize(&mut ser).is_err() {
        return "{}\n".to_owned();
    }
    let mut text = String::from_utf8(buf).unwrap_or_else(|_| "{}".to_owned());
    text.push('\n');
    text
}

/// Teks file proyek -> { data (sudah dinormalisasi), fonts }.
pub fn parse_project(src: &str) -> Result<(Value, Vec<Value>), String> {
    let src = src.trim_start_matches('\u{feff}');
    let j: Value = serde_json::from_str(src)
        .map_err(|_| "Isi file rusak (bukan JSON yang valid).".to_owned())?;
    parse_project_value(&j)
}

/// Sama seperti `parse_project` tetapi dari JSON yang sudah di-parse (menghindari parse ganda file besar).
pub fn parse_project_value(j: &Value) -> Result<(Value, Vec<Value>), String> {
    let Some(obj) = j.as_object() else {
        return Err("Ini bukan file proyek Ngaji.".to_owned());
    };
    let format = obj.get("format").and_then(Value::as_str).unwrap_or("");
    if format != PROJECT_FORMAT && format != LEGACY_PROJECT_FORMAT {
        return Err("Ini bukan file proyek Ngaji.".to_owned());
    }
    let version = obj.get("version").and_then(Value::as_i64).unwrap_or(0);
    if version < 1 {
        return Err("Versi file proyek tidak dikenali.".to_owned());
    }
    if version > PROJECT_VERSION {
        return Err(
            "File ini dibuat oleh versi aplikasi yang lebih baru. Perbarui aplikasi untuk membukanya."
                .to_owned(),
        );
    }
    let data = obj.get("data").cloned().unwrap_or(Value::Null);
    let data = normalize(data)?;
    let fonts = obj
        .get("fonts")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    Ok((data, fonts))
}

pub fn blank_project() -> Value {
    normalize(json!({
        "title": "Proyek Baru",
        "settings": {},
        "pages": [{ "id": "p1", "title": "Bab 1", "sentences": [] }]
    }))
    .unwrap_or_else(|_| json!({ "title": "Proyek Baru", "settings": {}, "pages": [] }))
}

/* ---------- CSS font lokal (opsional, untuk pemakaian offline) ---------- */

#[derive(Debug, Clone, Serialize, Default)]
pub struct FontMeta {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub family: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bold: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub italic: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FontFile {
    pub name: String,
    pub url: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub family: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bold: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub italic: Option<bool>,
}

pub fn read_font_meta(buf: &[u8]) -> Option<FontMeta> {
    let face = ttf_parser::Face::parse(buf, 0).ok()?;
    let mut family: Option<String> = None;
    let mut subfamily: Option<String> = None;
    let mut family_win = false;
    let mut sub_win = false;
    for name in face.names() {
        if name.name_id != 1 && name.name_id != 2 {
            continue;
        }
        let Some(text) = name.to_string() else {
            continue;
        };
        let is_win = name.platform_id == ttf_parser::PlatformId::Windows;
        if name.name_id == 1 {
            if is_win || family.is_none() {
                family = Some(text.trim().to_owned());
            }
            family_win |= is_win;
        } else if is_win || subfamily.is_none() {
            subfamily = Some(text.trim().to_owned());
            sub_win |= is_win;
        }
    }
    let _ = (family_win, sub_win);
    let family = family.filter(|s| !s.is_empty())?;
    let sub = subfamily.unwrap_or_default();
    Some(FontMeta {
        family: Some(family),
        bold: Some(sub.to_lowercase().contains("bold")),
        italic: Some(
            sub.to_lowercase().contains("italic") || sub.to_lowercase().contains("oblique"),
        ),
    })
}

fn strip_extension(name: &str) -> &str {
    match name.rfind('.') {
        Some(idx) if idx > 0 => &name[..idx],
        _ => name,
    }
}

fn remove_brackets(name: &str) -> String {
    let mut out = String::new();
    let mut in_bracket = false;
    for ch in name.chars() {
        match ch {
            '[' => in_bracket = true,
            ']' => in_bracket = false,
            _ if !in_bracket => out.push(ch),
            _ => {}
        }
    }
    out
}

/// Nama keluarga font untuk satu berkas: dari isi font -> pola nama file dikenal -> nama file.
pub fn font_family_of(name: &str, family: Option<&str>) -> String {
    if let Some(f) = family.map(str::trim).filter(|s| !s.is_empty()) {
        return f.to_owned();
    }
    let lower = name.to_lowercase();
    if lower.starts_with("amiri") {
        return "Amiri".to_owned();
    }
    if lower.starts_with("scheherazade") {
        return "Scheherazade New".to_owned();
    }
    if lower.starts_with("noto") {
        let rest = &lower[4..];
        let rest = rest.trim_start_matches(['-', '_', ' ']);
        if rest.starts_with("naskh") {
            return "Noto Naskh Arabic".to_owned();
        }
    }
    if lower.starts_with("arabtype") {
        return "Arabic Typesetting".to_owned();
    }
    if lower.starts_with("arabic") {
        let rest = lower.trim_start_matches("arabic");
        let rest2 = rest.trim_start_matches(['-', '_', ' ']);
        if rest2.starts_with("typesetting") {
            return "Arabic Typesetting".to_owned();
        }
    }

    let mut stem = remove_brackets(strip_extension(name));
    loop {
        let lower = stem.to_lowercase();
        let mut changed = false;
        for token in [
            "regular", "bold", "italic", "oblique", "light", "medium", "variable",
        ] {
            if lower.ends_with(token) {
                let cut = stem.len().saturating_sub(token.len());
                let Some(prefix) = stem.get(..cut) else {
                    continue;
                };
                stem = prefix
                    .trim_end_matches(['-', '_', ' '])
                    .to_owned();
                changed = true;
                break;
            }
        }
        if !changed {
            break;
        }
    }
    let out = stem.replace(['-', '_'], " ");
    let out = out.trim();
    if out.is_empty() {
        name.to_owned()
    } else {
        out.to_owned()
    }
}

pub fn build_font_css(files: &[FontFile]) -> String {
    let mut rules = Vec::new();
    for f in files {
        let ext = f
            .name
            .rsplit_once('.')
            .map(|(_, e)| format!(".{}", e.to_lowercase()))
            .unwrap_or_default();
        let format = match ext.as_str() {
            ".ttf" => "truetype",
            ".otf" => "opentype",
            ".woff" => "woff",
            ".woff2" => "woff2",
            _ => continue,
        };
        let lower = f.name.to_lowercase();
        let bracket_wght = f
            .name
            .split_once('[')
            .and_then(|(_, rest)| rest.split_once(']'))
            .map(|(inside, _)| inside.to_lowercase().contains("wght"))
            .unwrap_or(false);
        let variable = bracket_wght || lower.contains("variable");
        let bold = f.bold.unwrap_or_else(|| lower.contains("bold"));
        let italic = f
            .italic
            .unwrap_or_else(|| lower.contains("italic") || lower.contains("oblique"));
        let family = font_family_of(&f.name, f.family.as_deref()).replace('"', "");
        rules.push(format!(
            "@font-face{{font-family:\"{family}\";font-style:{};font-weight:{};font-display:swap;src:url(\"{}\") format(\"{}\");}}",
            if italic { "italic" } else { "normal" },
            if variable { "400 700" } else if bold { "700" } else { "400" },
            f.url,
            format
        ));
    }
    rules.join("\n")
}
