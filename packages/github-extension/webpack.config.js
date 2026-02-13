const path = require('path');  // パス操作用モジュール
const webpack = require('webpack');  // webpack本体（DefinePlugin用）
const CopyWebpackPlugin = require('copy-webpack-plugin');  // ファイルコピー用プラグイン
const { execSync } = require('child_process');  // 子プロセス実行用

// ========== ヘルパー関数 ==========

/**
 * 現在のGitブランチ名を取得（失敗時は 'unknown'）
 */
function getBranchName() {
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();  // gitコマンドでブランチ名取得
  } catch {
    return 'unknown';  // Gitリポジトリ外などの場合
  }
}

/**
 * ブランチ名をファイルシステム安全な文字列にサニタイズ
 * - `/` → `--` に置換
 * - Windows禁止文字を除去
 * - 100文字に制限
 */
function sanitizeBranchName(branch) {
  return branch
    .replace(/\//g, '--')  // スラッシュをダブルハイフンに変換
    .replace(/[<>:"|?*\\]/g, '')  // Windows禁止文字を除去
    .slice(0, 100);  // 100文字に制限
}

/**
 * WSL環境でWindowsの LOCALAPPDATA パスを取得
 * cmd.exe + wslpath で WSL パスに変換
 */
function getWindowsLocalAppData() {
  try {
    const winPath = execSync('cmd.exe /c "echo %LOCALAPPDATA%"', { encoding: 'utf-8' }).trim().replace(/\r/g, '');  // Windows側のLOCALAPPDATAを取得
    const wslPath = execSync(`wslpath -u "${winPath}"`, { encoding: 'utf-8' }).trim();  // WSLパスに変換
    return wslPath;
  } catch {
    return null;  // WSL以外の環境やコマンド失敗時
  }
}

/**
 * 開発モード用の出力パスを生成
 * WSL環境: /mnt/c/Users/.../AppData/Local/UiPathXamlVisualizer/extensions/<branch>/
 * それ以外: 従来の dist/ にフォールバック
 */
function getDevOutputPath(branch) {
  const localAppData = getWindowsLocalAppData();  // LOCALAPPDATA取得
  if (localAppData) {
    const sanitized = sanitizeBranchName(branch);  // ブランチ名をサニタイズ
    return path.join(localAppData, 'UiPathXamlVisualizer', 'extensions', sanitized);  // 固定パスを生成
  }
  return path.resolve(__dirname, 'dist');  // フォールバック: 従来のdist/
}

// ========== webpack設定（関数形式） ==========

module.exports = (env, argv) => {
  const mode = argv.mode || 'development';  // ビルドモード（デフォルト: development）
  const isDev = mode === 'development';  // 開発モードかどうか
  const branch = getBranchName();  // 現在のブランチ名
  const sanitizedBranch = sanitizeBranchName(branch);  // サニタイズ済みブランチ名

  // 出力先の決定: 開発モードはWindows固定パス、本番モードは従来のdist/
  const outputPath = isDev ? getDevOutputPath(branch) : path.resolve(__dirname, 'dist');  // 出力先パス

  console.log(`[webpack] mode: ${mode}, branch: ${branch}, output: ${outputPath}`);  // ビルド情報をログ出力

  return {
    entry: {
      content: './src/content.ts'  // エントリポイント（将来 background.ts 等を追加可能）
    },
    output: {
      path: outputPath,  // 出力先ディレクトリ
      filename: '[name].js',  // エントリ名をファイル名に使用（content.js 等）
      clean: true  // ビルド前に出力フォルダをクリーンアップ
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],  // 解決する拡張子
      alias: {
        '@uipath-xaml-visualizer/shared': path.resolve(__dirname, '../shared/dist')  // sharedはコンパイル済みJSを参照
      },
      fallback: {
        "fs": false,  // ブラウザ環境ではfsは使用不可
        "path": false  // ブラウザ環境ではpathは使用不可
      }
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,  // .tsまたは.tsxファイルに対して
          use: 'ts-loader',  // ts-loaderを使用
          include: path.resolve(__dirname, 'src')  // 自パッケージのsrcのみコンパイル
        },
        {
          test: /\.css$/,  // CSSファイルに対して
          use: ['style-loader', 'css-loader']  // style-loaderとcss-loaderを使用
        }
      ]
    },
    plugins: [
      new webpack.DefinePlugin({
        __BUILD_DATE__: JSON.stringify(new Date().toISOString()),  // ビルド日時を埋め込み
        __VERSION__: JSON.stringify(require('./package.json').version),  // バージョンを埋め込み
        __BRANCH_NAME__: JSON.stringify(branch)  // ブランチ名を埋め込み
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'manifest.json',
            to: 'manifest.json',
            transform(content) {
              // 開発モード & master以外 → manifest.jsonのnameにブランチ名を付与
              if (isDev && branch !== 'master' && branch !== 'unknown') {
                const manifest = JSON.parse(content.toString());  // JSONをパース
                manifest.name = `${manifest.name} [${sanitizedBranch}]`;  // ブランチ名を付与
                return JSON.stringify(manifest, null, 2);  // 整形して返す
              }
              return content;  // そのまま返す
            }
          },
          { from: 'icons', to: 'icons', noErrorOnMissing: true },  // アイコンをコピー（未作成でもOK）
          { from: 'popup.html', to: 'popup.html', noErrorOnMissing: true }  // ポップアップHTMLをコピー（未作成でもOK）
        ]
      })
    ],
    devtool: 'source-map',  // デバッグ用のソースマップを生成
    mode  // ビルドモード
  };
};
