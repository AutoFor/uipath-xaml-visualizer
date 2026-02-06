@echo off
REM UiPath XAML Visualizer - ローカルサーバー停止スクリプト

echo ========================================
echo UiPath XAML Visualizer
echo ローカルサーバー停止
echo ========================================
echo.

REM ポート8080を使用しているプロセスを強制終了
echo ポート8080を使用中のプロセスを停止中...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080') do (
    echo プロセスID %%a を終了します...
    taskkill /PID %%a /F
)

echo.
echo サーバーを停止しました。
echo.
pause
