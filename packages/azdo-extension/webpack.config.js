const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    viewer: './src/viewer.ts',           // XAMLファイルビューアのエントリポイント
    'diff-viewer': './src/diff-viewer.ts' // 差分ビューアのエントリポイント
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
        { from: 'src/viewer.html', to: 'viewer.html' },           // HTMLファイルをコピー
        { from: 'src/diff-viewer.html', to: 'diff-viewer.html' }, // 差分ビューアHTMLをコピー
        { from: 'src/styles', to: 'styles' }                      // スタイルシートをコピー
      ]
    })
  ],
  devtool: 'source-map',                   // デバッグ用のソースマップを生成
  mode: 'development'                      // 開発モード（本番時はproduction）
};
