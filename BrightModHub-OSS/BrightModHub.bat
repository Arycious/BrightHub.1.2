@echo off
title BrightModHub v1.0
color 0A

echo.
echo   ╔═══════════════════════════════════════════╗
echo   ║     🔍 BrightModHub v1.0                   ║
echo   ║     Twitch Bot Detection Dashboard          ║
echo   ╚═══════════════════════════════════════════╝
echo.

:: Check if Node.js is available
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo   [ERROR] Node.js not found!
    echo   Please install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Check if node_modules exists
if not exist "%~dp0node_modules" (
    echo   [SETUP] Installing dependencies...
    cd /d "%~dp0"
    npm install
    echo.
)

:: Check for --prod flag to run production build
if "%1"=="--prod" (
    echo   Starting PRODUCTION server...
    if not exist "%~dp0dist\server.js" (
        echo   [BUILD] No production build found. Building...
        cd /d "%~dp0"
        node build.js
        echo.
    )
    echo   Dashboard: http://localhost:3000
    echo   Press Ctrl+C to stop
    echo.
    cd /d "%~dp0"
    set NODE_ENV=production
    node dist/server.js
) else (
    echo   Starting DEV server...
    echo   Dashboard: http://localhost:3000
    echo   Press Ctrl+C to stop
    echo.
    cd /d "%~dp0"
    npm run dev
)

pause
