@echo off
REM UiPath XAML Visualizer - ローカルサーバー再起動スクリプト

echo ========================================
echo UiPath XAML Visualizer
echo ローカルサーバー再起動
echo ========================================
echo.

REM ポート8080を使用しているプロセスを強制終了
echo [1/3] ポート8080を使用中のプロセスを停止中...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080') do (
    echo プロセスID %%a を終了します...
    taskkill /PID %%a /F >nul 2>&1
)
echo 完了
echo.

REM 念のため1秒待機
timeout /t 1 /nobreak >nul

REM Webサーバーを起動
echo [2/3] Webサーバーを起動中...
echo ポート: 8080
echo ルート: %CD%
echo.
start "UiPath XAML Visualizer Server" cmd /k "npm run serve"

REM 起動待機
timeout /t 2 /nobreak >nul

echo [3/3] ブラウザで開く...
start http://localhost:8080/test/local-preview/viewer-test.html

echo.
echo ========================================
echo サーバーが起動しました！
echo URL: http://localhost:8080/test/local-preview/viewer-test.html
echo.
echo サーバーを停止するには、開いたコマンドウィンドウで Ctrl+C を押してください
echo ========================================
pause
