@echo off
echo =========================================
echo   Starting MindEase Backend & Frontend
echo =========================================

echo Launching FastAPI Backend (Port 8000)...
start "MindEase Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --reload"

echo Launching Vite Frontend...
start "MindEase Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Done! Check the opened terminal windows.
