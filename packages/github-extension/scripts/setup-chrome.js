#!/usr/bin/env node
/**
 * Chrome拡張機能セットアップ案内スクリプト
 * 手動でChromeに拡張機能をロードする際の手順を表示する
 */

const { execSync } = require('child_process');  // コマンド実行用
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
 * メイン処理
 */
function main() {  // エントリポイント
  const branch = getCurrentBranch();  // 現在のブランチ名
  const outputDir = getOutputDir();  // 出力先WSLパス
  const windowsPath = toWindowsPath(outputDir);  // Windowsパス
  const hasBuilt = fs.existsSync(path.join(outputDir, 'manifest.json'));  // ビルド済みか確認

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║       Chrome拡張機能 セットアップガイド                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log(`📌 現在のブランチ: ${branch}`);  // ブランチ名
  console.log(`📁 出力先（WSL）:   ${outputDir}`);  // WSLパス
  console.log(`📁 出力先（Win）:   ${windowsPath}`);  // Windowsパス
  console.log(`📦 ビルド状態:      ${hasBuilt ? '✅ ビルド済み' : '❌ 未ビルド'}\n`);  // ビルド状態

  if (!hasBuilt) {  // 未ビルドの場合
    console.log('⚠️  まずビルドを実行してください:\n');  // 警告
    console.log('   npm run build:fixed --workspace=packages/github-extension\n');  // ビルドコマンド
    console.log('   または\n');
    console.log('   npm run dev:fixed --workspace=packages/github-extension\n');  // watchモードコマンド
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📋 Chromeに拡張機能を手動ロードする手順:\n');  // 手順タイトル
  console.log('   1. Chromeで chrome://extensions を開く');  // 手順1
  console.log('   2. 右上の「デベロッパーモード」を有効にする');  // 手順2
  console.log('   3. 「パッケージ化されていない拡張機能を読み込む」をクリック');  // 手順3
  console.log(`   4. 以下のパスを入力:\n`);  // 手順4
  console.log(`      ${windowsPath}\n`);  // パス表示

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n💡 便利なコマンド:\n');  // 便利なコマンド一覧
  console.log('   npm run dev:fixed    # watchモードでビルド（ファイル変更時に自動リビルド）');  // watchモード
  console.log('   npm run dev:chrome   # Chrome自動起動 + watchモード');  // Chrome自動起動
  console.log('   npm run build:fixed  # 本番ビルド\n');  // 本番ビルド

  // Chrome拡張ページを自動で開く試行
  try {
    execSync('cmd.exe /c start chrome://extensions 2>/dev/null', { stdio: 'ignore' });  // chrome://extensionsを開く
    console.log('🌐 chrome://extensions を開きました\n');  // 成功メッセージ
  } catch {
    console.log('💡 chrome://extensions をブラウザで開いてください\n');  // 手動で開く案内
  }
}

main();  // スクリプト実行
