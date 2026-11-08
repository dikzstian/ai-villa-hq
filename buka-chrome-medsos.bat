@echo off
title Villa HQ - Chrome Khusus Medsos (Port 9222)
echo ========================================================
echo   MEMBUKA CHROME KHUSUS MEDSOS UNTUK NADIA ^& TIM AI
echo ========================================================
echo.
echo Menutup sesi background port 9222 (jika ada) agar jendela muncul di layar Anda...
powershell -NoProfile -Command "Invoke-RestMethod -Method POST -Uri 'http://127.0.0.1:3001/api/social-browser/close' -ErrorAction SilentlyContinue | Out-Null"

set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_PATH%" set "CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_PATH%" set "CHROME_PATH=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

set "PROFILE_DIR=%~dp0hermes_workspace\browser_profile"
if not exist "%PROFILE_DIR%" mkdir "%PROFILE_DIR%"

echo Membuka jendela Google Chrome Khusus Medsos...
start "" "%CHROME_PATH%" --user-data-dir="%PROFILE_DIR%" --remote-debugging-port=9222 --remote-allow-origins=* --no-first-run --no-default-browser-check --new-window "https://www.instagram.com/" "https://www.tiktok.com/tiktokstudio"

echo.
echo Selesai! Jendela Chrome Khusus Medsos sudah terbuka di layar Anda.
echo Silakan login sekali saja, lalu kembali ke http://localhost:5173
timeout /t 3 >nul
