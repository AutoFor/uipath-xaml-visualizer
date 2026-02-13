#!/usr/bin/env node
/**
 * Chrome自動起動 + webpack watchモード + 自動リロード スクリプト
 * WSL2上で開発し、Windows側のChromeで動作確認するためのスクリプト
 */

const { spawn, execSync } = require('child_process');  // 子プロセス実行用
const path = require('path');  // パス操作用
const os = require('os');  // OS情報取得用
const fs = require('fs');  // ファイルシステム操作用

/**
 * 現在のGitブランチ名を取得する
 */
function getCurrentBranch() {  // ブランチ名を返す
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();  // gitコマンドで取得
  } catch {
    return 'unknown';  // フォールバック
  }
}

/**
 * ブランチ名をファイルシステム安全な文字列に変換する
 */
function sanitizeBranchName(branch) {  // 特殊文字を除去
  return branch.replace(/[^a-zA-Z0-9_-]/g, '-');  // 安全な文字のみ残す
}

/**
 * 固定出力先のWSLパスを取得する
 */
function getOutputDir() {  // 出力先パスを返す
  const branch = sanitizeBranchName(getCurrentBranch());  // サニタイズ済みブランチ名
  return path.resolve(os.homedir(), '.chrome-extensions', 'uipath-xaml-visualizer', branch);  // 固定パス
}

/**
 * WSLパスをWindowsパスに変換する
 */
function toWindowsPath(wslPath) {  // WSLパス → Windowsパス変換
  try {
    return execSync(`wslpath -w "${wslPath}"`, { encoding: 'utf8' }).trim();  // wslpathコマンドで変換
  } catch {
    return wslPath;  // 変換失敗時はそのまま返す
  }
}

/**
 * Windows側のChrome実行ファイルパスを検索する
 */
function findChromeBinary() {  // Chromeのパスを探す
  const candidates = [  // Chrome実行ファイルの候補パス
    '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',  // 標準インストール先
    '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',  // 32bitインストール先
  ];

  for (const candidate of candidates) {  // 各候補を確認
    if (fs.existsSync(candidate)) {  // ファイルが存在すれば
      return candidate;  // そのパスを返す
    }
  }

  return null;  // 見つからなかった場合
}

/**
 * 出力先ディレクトリにビルド済みファイルが揃うまで待機する
 */
function waitForBuild(outputDir, maxWaitMs = 60000) {  // ビルド完了を待機
  return new Promise((resolve, reject) => {  // Promiseで非同期処理
    const startTime = Date.now();  // 開始時刻
    const requiredFile = path.join(outputDir, 'manifest.json');  // 必須ファイル

    const check = () => {  // 定期チェック関数
      if (fs.existsSync(requiredFile)) {  // manifest.jsonが存在すれば
        resolve();  // ビルド完了
        return;
      }
      if (Date.now() - startTime > maxWaitMs) {  // タイムアウト判定
        reject(new Error(`ビルドが${maxWaitMs / 1000}秒以内に完了しませんでした`));  // エラー
        return;
      }
      setTimeout(check, 1000);  // 1秒後に再チェック
    };

    check();  // 初回チェック開始
  });
}

/**
 * メイン処理
 */
async function main() {  // エントリポイント
  const outputDir = getOutputDir();  // 出力先パス
  const branch = getCurrentBranch();  // ブランチ名

  console.log(`\n🔧 Chrome拡張機能 開発モード`);  // 開始メッセージ
  console.log(`   ブランチ: ${branch}`);  // ブランチ名表示
  console.log(`   出力先: ${outputDir}\n`);  // 出力先表示

  // webpack watchモードを起動（FIXED_OUTPUT=1）
  const webpackBin = path.resolve(__dirname, '..', 'node_modules', '.bin', 'webpack');  // webpackバイナリパス
  const webpack = spawn(webpackBin, ['--mode', 'development', '--watch'], {  // watchモードで起動
    cwd: path.resolve(__dirname, '..'),  // github-extensionディレクトリで実行
    env: { ...process.env, FIXED_OUTPUT: '1' },  // 固定出力先を有効化
    stdio: ['ignore', 'pipe', 'pipe']  // stdin無効、stdout/stderrはpipe
  });

  webpack.stdout.on('data', (data) => {  // webpackのstdout出力
    process.stdout.write(data);  // そのまま表示
  });

  webpack.stderr.on('data', (data) => {  // webpackのstderr出力
    process.stderr.write(data);  // そのまま表示
  });

  webpack.on('error', (err) => {  // webpack起動エラー
    console.error(`webpackの起動に失敗しました: ${err.message}`);  // エラー表示
    process.exit(1);  // 終了
  });

  console.log('⏳ 初回ビルドを待機中...\n');  // 待機メッセージ

  try {
    await waitForBuild(outputDir);  // ビルド完了を待機
  } catch (err) {
    console.error(err.message);  // タイムアウトエラー
    webpack.kill();  // webpackを終了
    process.exit(1);  // 終了
  }

  console.log('✅ ビルド完了\n');  // ビルド完了メッセージ

  // Chrome起動方法を決定
  const chromeBinary = findChromeBinary();  // Chrome実行ファイルを検索
  const windowsPath = toWindowsPath(outputDir);  // Windowsパスに変換

  if (chromeBinary) {  // Chromeが見つかった場合
    console.log(`🚀 Chromeを起動します...`);  // 起動メッセージ
    console.log(`   拡張機能パス: ${windowsPath}\n`);  // パス表示

    // web-ext run でChromeを起動
    const webExtBin = path.resolve(__dirname, '..', 'node_modules', '.bin', 'web-ext');  // web-extバイナリパス
    const webExt = spawn(webExtBin, [  // web-extを起動
      'run',
      '--target=chromium',  // Chromiumブラウザを対象
      `--source-dir=${outputDir}`,  // 拡張機能のソースディレクトリ
      `--chromium-binary=${chromeBinary}`,  // Chrome実行ファイル
      '--no-reload'  // web-extの自動リロードを無効化（webpackのwatchで対応）
    ], {
      cwd: path.resolve(__dirname, '..'),  // github-extensionディレクトリで実行
      stdio: 'inherit'  // 親プロセスのstdio共有
    });

    webExt.on('error', () => {  // web-ext起動失敗時のフォールバック
      console.log('\n⚠️  web-extでの起動に失敗しました。手動でChromeを起動してください。');  // 警告
      console.log(`   拡張機能パス（Windows）: ${windowsPath}`);  // Windowsパス表示
      console.log(`   chrome://extensions を開き「パッケージ化されていない拡張機能を読み込む」で上記パスを指定\n`);
    });

    webExt.on('close', () => {  // web-ext終了時
      webpack.kill();  // webpackも終了
      process.exit(0);  // 正常終了
    });
  } else {  // Chromeが見つからなかった場合
    console.log('⚠️  Windows側のChromeが見つかりませんでした。');  // 警告
    console.log('   手動でChromeを起動してください。\n');  // 案内

    // Chrome拡張ページを開く試行
    try {
      execSync('cmd.exe /c start chrome://extensions', { stdio: 'ignore' });  // chrome://extensionsを開く
    } catch {
      // cmd.exe失敗時は無視
    }

    console.log(`   拡張機能パス（Windows）: ${windowsPath}`);  // Windowsパス表示
    console.log(`   chrome://extensions を開き「パッケージ化されていない拡張機能を読み込む」で上記パスを指定\n`);
    console.log('📝 webpackのwatchモードは引き続き動作中です。ファイルを変更するとリビルドされます。');  // 案内
    console.log('   Chromeの拡張機能ページで手動リロードしてください。\n');  // リロード案内
  }

  // プロセス終了時のクリーンアップ
  process.on('SIGINT', () => {  // Ctrl+C時
    webpack.kill();  // webpackを終了
    process.exit(0);  // 正常終了
  });

  process.on('SIGTERM', () => {  // SIGTERM時
    webpack.kill();  // webpackを終了
    process.exit(0);  // 正常終了
  });
}

main().catch((err) => {  // エラーハンドリング
  console.error('エラーが発生しました:', err.message);  // エラー表示
  process.exit(1);  // 異常終了
});
