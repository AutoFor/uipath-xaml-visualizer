@echo off
chcp 65001 >nul
REM UiPath XAML Visualizer - Stop Local Server

echo ========================================
echo UiPath XAML Visualizer
echo Stop Local Server
echo ========================================
echo.

REM Stop processes using port 8080
echo Stopping processes on port 8080...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080') do (
    echo Killing process ID %%a...
    taskkill /PID %%a /F
)

echo.
echo Server stopped.
echo.
pause
