# UiPath XAML Visualizer

GitHub上のUiPath XAMLワークフローファイルを視覚的に表示するChrome拡張機能です。

## 概要

このプロジェクトは、GitHub上のUiPath XAMLファイルを、生のXMLコードではなく、視覚的に理解しやすい形式で表示するChrome拡張機能を提供します。

### 主な機能

- **ビジュアル表示**: ワークフロー構造を直感的に表示
- **ツリービュー**: アクティビティ階層をツリー形式で表示
- **詳細パネル**: アクティビティのプロパティを詳細表示
- **差分表示**: PRやコミット差分をビジュアルに表示
- **スクリーンショット表示**: Informative Screenshotの表示に対応

## インストール

### Chrome拡張機能

1. Chrome Web Storeから拡張機能をインストール
2. GitHubのXAMLファイルページでボタンが表示される

## 開発

### 前提条件

- Node.js 20.x以上
- npm 9.x以上

### セットアップ

```bash
# 依存関係のインストール
npm install

# 共通ライブラリのビルド
npm run build:shared

# GitHub拡張機能のビルド
npm run build:github

# 開発モード（ファイル監視）
npm run dev:github

# 全体ビルド
npm run build
```

### プロジェクト構成（モノレポ）

```
uipath-xaml-visualizer/
├── packages/
│   ├── shared/                    # 共通ライブラリ
│   │   ├── parser/                # XAMLパーサー
│   │   │   ├── xaml-parser.ts     # XAML解析
│   │   │   └── diff-calculator.ts # 差分計算
│   │   ├── renderer/              # レンダラー
│   │   │   ├── sequence-renderer.ts  # Sequenceレンダリング
│   │   │   ├── tree-view-renderer.ts # ツリービュー
│   │   │   └── diff-renderer.ts      # 差分表示
│   │   ├── styles/                # スタイルシート
│   │   ├── index.ts               # エクスポート
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── github-extension/          # GitHub拡張機能（Chrome）
│       ├── src/
│       │   ├── content.ts         # コンテンツスクリプト
│       │   └── background.ts      # バックグラウンドスクリプト
│       ├── manifest.json
│       └── package.json
├── test/                          # テスト用サンプル
├── package.json                   # ルートパッケージ
└── README.md
```

### テスト

```bash
# テスト実行
npm test
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

## GitHub Pages

このリポジトリでは、`main`/`master`ブランチへのマージ時に、自動的にGitHub Pagesへデプロイされます。

- **公開ページ**: https://autofor.github.io/uipath-xaml-visualizer/

## GitHub統合（Claude Code）

このリポジトリでは、IssueやPull Requestで `@claude` にメンションすると、Claude Codeが自動的に応答します。

### セットアップ手順

1. **GitHub Appのインストール**
   - VSCode Claude Codeで `/install-github-app` を実行
   - ブラウザでGitHubアプリをこのリポジトリにインストール

2. **ANTHROPIC_API_KEYの設定**
   - GitHubリポジトリの Settings > Secrets and variables > Actions
   - `ANTHROPIC_API_KEY` を追加（Anthropic APIキーを設定）

3. **使い方**
   - Issueまたはコメントで `@claude` とメンション
   - 例: `@claude このリポジトリの構成を要約して`
   - Claude Codeが自動的にコメントで返信します

**注意:** `@claude` はGitHubのメンション候補には表示されませんが、手で入力すれば動作します。

## ライセンス

MIT

## 貢献

Issue・Pull Requestを歓迎します！

## 参考

- [UiPath Documentation](https://docs.uipath.com/)
- [Chrome Extensions Documentation](https://developer.chrome.com/docs/extensions/)
