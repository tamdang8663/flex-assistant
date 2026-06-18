@echo off
echo === Flex Assistant - Fix Cache ===
echo.

REM Go to script directory (run this bat from inside flex-assistant folder)
cd /d "%~dp0"

echo [1/3] Stopping any running Next.js...
taskkill /f /im node.exe >nul 2>&1

echo [2/3] Deleting .next cache...
if exist ".next" (
    rmdir /s /q ".next"
    echo     .next deleted OK
) else (
    echo     .next not found - OK
)

echo [3/3] Starting dev server...
echo.
npm run dev
