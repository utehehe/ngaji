#!/usr/bin/env bash
cd "$(dirname "$0")"
command -v cargo >/dev/null || { echo "[X] Rust belum terpasang: https://rustup.rs"; exit 1; }
if cargo tauri --version >/dev/null 2>&1; then
  exec cargo tauri dev
fi
command -v npm >/dev/null || { echo "[X] Butuh Tauri CLI: cargo install tauri-cli --version '^2'  (atau pasang Node.js 18+)"; exit 1; }
[ -d node_modules/@tauri-apps/cli ] || npm install || { echo "[X] npm install gagal"; exit 1; }
exec npm run dev
