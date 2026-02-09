const path = require('path'); // パス操作

module.exports = {
  target: 'node', // Node.js環境用にビルド
  entry: './src/extension.ts', // エントリーポイント
  output: {
    path: path.resolve(__dirname, 'dist'), // 出力ディレクトリ
    filename: 'extension.js', // 出力ファイル名
    libraryTarget: 'commonjs2', // CommonJS2形式で出力
    devtoolModuleFilenameTemplate: '../[resource-path]' // ソースマップのパス設定
  },
  devtool: 'source-map', // ソースマップを生成
  externals: {
    vscode: 'commonjs vscode' // VSCode APIは外部依存として扱う
  },
  resolve: {
    extensions: ['.ts', '.js'] // 解決する拡張子
  },
  module: {
    rules: [
      {
        test: /\.ts$/, // TypeScriptファイル
        exclude: /node_modules/, // node_modulesを除外
        use: [
          {
            loader: 'ts-loader' // TypeScriptローダー
          }
        ]
      }
    ]
  }
};
