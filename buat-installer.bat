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
  cargo tauri build
  goto :done
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [X] Butuh Tauri CLI. Pasang dengan: cargo install tauri-cli --version "^2"
  echo     atau pasang Node.js 18+ dari https://nodejs.org
  pause & exit /b 1
)
if not exist "node_modules\@tauri-apps\cli" call npm install
call npm run build
:done
if errorlevel 1 ( echo [X] Build gagal. & pause & exit /b 1 )
echo.
echo Selesai. Installer ada di: src-tauri\target\release\bundle\
pause
