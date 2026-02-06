const path = require('path');

module.exports = {
  mode: 'development',
  entry: {
    'test-viewer': './src/test-viewer-standalone.ts'  // テスト用のエントリポイント
  },
  output: {
    path: path.resolve(__dirname, 'test/local-preview'),  // テストフォルダに出力
    filename: '[name].js',
    library: {
      name: 'XamlViewer',
      type: 'var',
      export: 'default'
    }
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  devtool: 'source-map'
};
