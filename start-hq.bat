@echo off
title Digital Marketing AI Villa HQ (09:00 - 17:00)
cd /d "%~dp0"
echo ========================================================
echo   DIGITAL MARKETING AI-AGENT 3D VILLA HQ (LOCALHOST)
echo   Starting Backend Server (3001) + 3D Villa UI (5173)...
echo ========================================================
start "" cmd /c "timeout /t 4 >nul && start http://localhost:5173"
npm run dev
pause
