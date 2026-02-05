# UiPath XAML Visualizer for Azure DevOps

Azure DevOps上でUiPath XAMLワークフローファイルを視覚的に表示する拡張機能です。

## 概要

この拡張機能は、Azure DevOpsのリポジトリ内のUiPath XAMLファイルを、生のXMLコードではなく、視覚的に理解しやすい形式で表示します。

### 主な機能

- **ビジュアル表示**: ワークフロー構造を直感的に表示
- **ツリービュー**: アクティビティ階層をツリー形式で表示
- **詳細パネル**: アクティビティのプロパティを詳細表示
- **差分表示**: PRやコミット差分をビジュアルに表示
- **スクリーンショット表示**: Informative Screenshotの表示に対応

## インストール

1. Azure DevOps Marketplaceから拡張機能をインストール
2. リポジトリの設定で拡張機能を有効化

## 使い方

### XAMLファイルの表示

1. Azure DevOpsのリポジトリで`.xaml`ファイルを開く
2. 自動的にビジュアルビューが表示される
3. 「Raw XML」ボタンで生のXMLに切り替え可能

### 差分表示

1. Pull Requestまたはコミット差分ページで`.xaml`ファイルの変更を確認
2. 「Visual Diff」ボタンをクリック
3. アクティビティレベルでの追加・削除・変更が表示される

## 開発

### 前提条件

- Node.js 20.x以上
- npm 9.x以上
- tfx-cli (`npm install -g tfx-cli`)

### セットアップ

```bash
# 依存関係のインストール
npm install

# 開発モードでビルド（ファイル監視）
npm run dev

# 本番用ビルド
npm run build

# 拡張機能パッケージの作成
npm run package
```

### プロジェクト構成

```
uipath-github-xaml-visualizer/
├── src/
│   ├── parser/              # XAMLパーサー
│   │   ├── xaml-parser.ts   # XAML解析
│   │   └── diff-calculator.ts # 差分計算
│   ├── renderer/            # レンダラー
│   │   ├── sequence-renderer.ts
│   │   ├── tree-view-renderer.ts
│   │   └── diff-renderer.ts
│   ├── styles/              # スタイルシート
│   │   ├── main.css
│   │   └── diff.css
│   ├── viewer.ts            # ビューアメイン
│   ├── viewer.html
│   ├── diff-viewer.ts       # 差分ビューアメイン
│   └── diff-viewer.html
├── dist/                    # ビルド結果
├── spec.md                  # プロジェクト仕様書
├── package.json
├── tsconfig.json
├── webpack.config.js
└── vss-extension.json       # Azure DevOps拡張機能マニフェスト
```

### テスト

```bash
# ユニットテスト実行
npm run test:unit

# 統合テスト実行
npm run test:integration

# カバレッジ付きテスト
npm run test:coverage
```

## 対応アクティビティ

- Sequence
- Flowchart
- StateMachine
- Assign
- If / Else
- While / DoWhile
- ForEach
- Click / TypeInto / GetText
- LogMessage
- InvokeWorkflowFile
- TryCatch
- その他多数

## ライセンス

MIT

## 貢献

Issue・Pull Requestを歓迎します！

## 参考

- [UiPath Documentation](https://docs.uipath.com/)
- [Azure DevOps Extension SDK](https://github.com/microsoft/azure-devops-extension-sdk)
