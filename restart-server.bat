@echo off
chcp 65001 >nul
REM UiPath XAML Visualizer - Local Server Restart

echo ========================================
echo UiPath XAML Visualizer
echo Local Server Restart
echo ========================================
echo.

REM Stop processes using port 8080
echo [1/3] Stopping processes on port 8080...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080') do (
    echo Killing process ID %%a...
    taskkill /PID %%a /F >nul 2>&1
)
echo Done
echo.

REM Wait 1 second
timeout /t 1 /nobreak >nul

REM Start web server
echo [2/3] Starting web server...
echo Port: 8080
echo Root: %CD%
echo.
start "UiPath XAML Visualizer Server" cmd /k "npm run serve"

REM Wait for startup
timeout /t 2 /nobreak >nul

echo [3/3] Opening browser...
start http://localhost:8080/test/local-preview/viewer-test.html

echo.
echo ========================================
echo Server started!
echo URL: http://localhost:8080/test/local-preview/viewer-test.html
echo.
echo To stop server, press Ctrl+C in the opened window
echo ========================================
pause
