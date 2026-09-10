@echo off
setlocal enabledelayedexpansion
title BIS Sahayak — Startup
color 0A

echo.
echo  ===================================================
echo   BIS Sahayak  ^|  Hackathon 2026
echo   Starting Backend + Frontend...
echo  ===================================================
echo.

:: ── Paths ─────────────────────────────────────────────────────────────────
set "PROJECT_ROOT=d:\Hackathon-2026\Hackathon-2026"
set "FRONTEND_DIR=%PROJECT_ROOT%\frontend"
set "PYTHON_VENV=%PROJECT_ROOT%\.venv\Scripts\python.exe"
set "UVICORN_VENV=%PROJECT_ROOT%\.venv\Scripts\uvicorn.exe"
set "ACTIVATE=%PROJECT_ROOT%\.venv\Scripts\activate.bat"

:: ── Check: Project root exists ────────────────────────────────────────────
if not exist "%PROJECT_ROOT%" (
    echo [ERROR] Project root not found:
    echo         %PROJECT_ROOT%
    echo.
    pause
    exit /b 1
)

:: ── Check: Python venv exists ─────────────────────────────────────────────
if not exist "%PYTHON_VENV%" (
    echo [ERROR] Python virtual environment not found.
    echo         Expected: %PYTHON_VENV%
    echo.
    echo  Fix: Open a terminal and run:
    echo    cd /d %PROJECT_ROOT%
    echo    python -m venv .venv
    echo    .venv\Scripts\activate
    echo    pip install -e .[dev]
    echo.
    pause
    exit /b 1
)

:: ── Check: uvicorn installed in venv ─────────────────────────────────────
if not exist "%UVICORN_VENV%" (
    echo [WARN] uvicorn not found in venv. Falling back to: python -m uvicorn
    echo        (This still works — just means it's installed as a module)
    echo.
    set "USE_MODULE_UVICORN=1"
) else (
    set "USE_MODULE_UVICORN=0"
)

:: ── Check: npm available ─────────────────────────────────────────────────
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found in PATH.
    echo         Install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: ── Check: node_modules installed ────────────────────────────────────────
if not exist "%FRONTEND_DIR%\node_modules" (
    echo [INFO] node_modules not found. Running npm install first...
    cd /d "%FRONTEND_DIR%"
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed. Check the output above.
        pause
        exit /b 1
    )
    echo [INFO] npm install complete.
    echo.
)

:: ── 1. Start Backend ──────────────────────────────────────────────────────
echo [1/2] Starting Backend (FastAPI on http://localhost:8000)...

if "%USE_MODULE_UVICORN%"=="1" (
    start "BIS Backend — FastAPI" cmd /k "cd /d "%PROJECT_ROOT%" && call "%ACTIVATE%" && python -m uvicorn bis.api.main:app --reload --host 0.0.0.0 --port 8000"
) else (
    start "BIS Backend — FastAPI" cmd /k "cd /d "%PROJECT_ROOT%" && call "%ACTIVATE%" && uvicorn bis.api.main:app --reload --host 0.0.0.0 --port 8000"
)

timeout /t 2 /nobreak >nul

:: ── 2. Start Frontend ─────────────────────────────────────────────────────
echo [2/2] Starting Frontend (Next.js on http://localhost:3000)...
start "BIS Frontend — Next.js" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev"

:: ── 3. Open browser ───────────────────────────────────────────────────────
echo.
echo  Both servers are starting. Waiting 7 seconds for boot...
echo.
echo   Frontend  ^>  http://localhost:3000
echo   API Docs  ^>  http://localhost:8000/docs
echo.
timeout /t 7 /nobreak >nul
start "" "http://localhost:3000"

echo  Done! You can close this window.
echo.
pause
