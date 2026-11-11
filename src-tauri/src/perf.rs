//! Pengukur waktu ringan untuk jalur yang terasa lambat (mis. membuka kitab).
//! `begin()` memulai, `mark("langkah")` mencatat waktu kumulatif (ms), `finish()` mengembalikan daftar langkah
//! dan menambahkannya ke `perf.log` di folder data supaya mudah dikirim bila masih lambat.

use std::io::Write;
use std::path::Path;
use std::sync::Mutex;
use std::time::Instant;

use serde_json::{json, Value};

static PERF: Mutex<Option<(Instant, Vec<(String, u128)>)>> = Mutex::new(None);

pub fn begin() {
    *PERF.lock().unwrap_or_else(|e| e.into_inner()) = Some((Instant::now(), Vec::new()));
}

pub fn mark(name: &str) {
    if let Some((t0, marks)) = PERF.lock().unwrap_or_else(|e| e.into_inner()).as_mut() {
        marks.push((name.to_owned(), t0.elapsed().as_millis()));
    }
}

/// Selesai: kembalikan `{ "total": ms, "langkah": [[nama, ms], ...] }` dan tulis satu baris ke `perf.log`.
pub fn finish(data_dir: &Path, label: &str) -> Value {
    let taken = PERF.lock().unwrap_or_else(|e| e.into_inner()).take();
    let Some((t0, marks)) = taken else {
        return Value::Null;
    };
    let total = t0.elapsed().as_millis();
    let steps: Vec<String> = marks.iter().map(|(n, ms)| format!("{n}={ms}ms")).collect();
    let line = format!("{} total={}ms | {}\n", label, total, steps.join(" "));
    if let Ok(meta) = std::fs::metadata(data_dir.join("perf.log")) {
        if meta.len() > 200_000 {
            let _ = std::fs::remove_file(data_dir.join("perf.log"));
        }
    }
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(data_dir.join("perf.log"))
    {
        let _ = f.write_all(line.as_bytes());
    }
    json!({ "total": total, "langkah": marks.iter().map(|(n, ms)| json!([n, ms])).collect::<Vec<_>>() })
}
