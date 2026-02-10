const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    viewer: './viewer.ts',           // XAMLファイルビューアのエントリポイント
    'diff-viewer': './diff-viewer.ts' // 差分ビューアのエントリポイント
  },
  output: {
    path: path.resolve(__dirname, 'dist'), // 出力先ディレクトリ
    filename: '[name].js',                 // 出力ファイル名（entry名を使用）
    clean: true                            // ビルド前にdistフォルダをクリーンアップ
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],    // 解決する拡張子
    alias: {
      '@': path.resolve(__dirname, 'src')  // @でsrcフォルダを参照可能に
    },
    fallback: {
      "fs": false,  // ブラウザ環境ではfsは使用不可
      "path": false  // ブラウザ環境ではpathは使用不可
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,                   // .tsまたは.tsxファイルに対して
        use: 'ts-loader',                  // ts-loaderを使用
        exclude: /node_modules/            // node_modulesは除外
      },
      {
        test: /\.css$/,                    // CSSファイルに対して
        use: ['style-loader', 'css-loader'] // style-loaderとcss-loaderを使用
      }
    ]
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'viewer.html', to: 'viewer.html' },           // HTMLファイルをコピー
        { from: 'diff-viewer.html', to: 'diff-viewer.html' }, // 差分ビューアHTMLをコピー
        { from: '../../src/styles', to: 'styles' }            // スタイルシートをコピー
      ]
    })
  ],
  devtool: 'source-map',                   // デバッグ用のソースマップを生成
  mode: 'development'                      // 開発モード（本番時はproduction）
};
