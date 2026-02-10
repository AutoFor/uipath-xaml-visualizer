const path = require('path');  // パス操作用モジュール
const CopyWebpackPlugin = require('copy-webpack-plugin');  // ファイルコピー用プラグイン

module.exports = {
  entry: './src/content.ts',  // エントリポイント（GitHub拡張機能のコンテンツスクリプト）
  output: {
    path: path.resolve(__dirname, 'dist'),  // 出力先ディレクトリ
    filename: 'content.js',  // 出力ファイル名
    clean: true  // ビルド前にdistフォルダをクリーンアップ
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],  // 解決する拡張子
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
        exclude: /node_modules/  // node_modulesは除外
      }
    ]
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' }  // manifest.jsonをコピー
      ]
    })
  ],
  devtool: 'source-map',  // デバッグ用のソースマップを生成
  mode: 'development'  // 開発モード（本番時はproduction）
};
