@echo off
title 🏠 Villa HQ - Digital Marketing AI Agent
color 0A

echo.
echo  ╔═══════════════════════════════════════════════╗
echo  ║   🏠  VILLA HQ - AI Agent Digital Marketing  ║
echo  ║       Memulai server + membuka browser...     ║
echo  ╚═══════════════════════════════════════════════╝
echo.

cd /d "d:\Dika\Ai-Agent"

echo [1/2] Menjalankan server backend (port 3001) + frontend (port 5173)...
start "Villa HQ Server" cmd /k "npm run dev"

echo [2/2] Menunggu server siap (5 detik)...
timeout /t 5 /nobreak >nul

echo Membuka Villa HQ di browser...
start http://localhost:5173

echo.
echo  ✅ Villa HQ sudah berjalan!
echo  🌐 Buka browser di: http://localhost:5173
echo  ⚙️  Backend API di:  http://localhost:3001
echo.
echo  ⚠️  JANGAN TUTUP jendela CMD "Villa HQ Server" 
echo      selama masih mau pakai Villa HQ.
echo.
echo  Tekan tombol apa saja untuk menutup jendela ini...
pause >nul
