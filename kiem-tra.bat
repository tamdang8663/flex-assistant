@echo off
chcp 65001 >nul
echo ========================================
echo   KIEM TRA FILE FLEX ASSISTANT
echo ========================================
echo.

REM Kiem tra types.ts
echo [1] Kiem tra types.ts...
findstr /c:"codes: string" "src\lib\types.ts" >nul 2>&1
if %errorlevel%==0 (
    echo     OK - types.ts co "codes: string[]"
) else (
    echo     LOI - types.ts van con file cu!
    echo     Can copy lai: src\lib\types.ts
)
echo.

REM Kiem tra route.ts
echo [2] Kiem tra route.ts...
findstr /c:"parseGateData" "src\app\api\ocr\route.ts" >nul 2>&1
if %errorlevel%==0 (
    echo     OK - route.ts co "parseGateData"
) else (
    echo     LOI - route.ts van con file cu!
    echo     Can copy lai: src\app\api\ocr\route.ts
)
echo.

REM Kiem tra page.tsx
echo [3] Kiem tra page.tsx...
findstr /c:"ScreenshotResult" "src\app\import-gates\page.tsx" >nul 2>&1
if %errorlevel%==0 (
    echo     OK - page.tsx co "ScreenshotResult"
) else (
    echo     LOI - page.tsx van con file cu!
    echo     Can copy lai: src\app\import-gates\page.tsx
)
echo.

echo ========================================
echo   XOA CACHE VA KHOI DONG LAI
echo ========================================
echo.
set /p confirm=Ban co muon xoa .next va chay lai khong? (y/n): 
if /i "%confirm%"=="y" (
    echo Dang xoa .next...
    if exist ".next" rmdir /s /q ".next"
    echo Xoa xong. Dang khoi dong lai...
    echo.
    npm run dev
) else (
    echo.
    echo Chay thu cong:
    echo   rmdir /s /q .next
    echo   npm run dev
)
