@echo off
setlocal
cd /d "%~dp0"
where cargo >nul 2>nul
if errorlevel 1 (
  echo [X] Rust belum terpasang. Pasang dari https://rustup.rs lalu jalankan ulang.
  pause & exit /b 1
)
cargo tauri --version >nul 2>nul
if not errorlevel 1 (
  cargo tauri dev
  goto :end
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [X] Butuh Tauri CLI. Pasang dengan: cargo install tauri-cli --version "^2"
  echo     atau pasang Node.js 18+ dari https://nodejs.org
  pause & exit /b 1
)
if not exist "node_modules\@tauri-apps\cli" call npm install
call npm run dev
:end
if errorlevel 1 pause
