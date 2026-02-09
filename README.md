# UiPath XAML Visualizer

UiPath XAMLワークフローファイルを視覚的に表示するツール群です。Azure DevOps、VSCode、GitHubに対応しています。

## 概要

このプロジェクトは、UiPath XAMLファイルを、生のXMLコードではなく、視覚的に理解しやすい形式で表示する複数の拡張機能を提供します。

### 対応プラットフォーム

- **Azure DevOps**: Azure DevOps上でXAMLファイルを視覚化
- **VSCode**: VSCodeエディタおよびソース管理画面でXAMLファイルを視覚化
- **GitHub**: GitHub上のXAMLファイルをChrome拡張機能で視覚化

### 主な機能

- **ビジュアル表示**: ワークフロー構造を直感的に表示
- **ツリービュー**: アクティビティ階層をツリー形式で表示
- **詳細パネル**: アクティビティのプロパティを詳細表示
- **差分表示**: PRやコミット差分をビジュアルに表示
- **スクリーンショット表示**: Informative Screenshotの表示に対応

## インストール

### Azure DevOps拡張機能

1. Azure DevOps Marketplaceから拡張機能をインストール
2. リポジトリの設定で拡張機能を有効化

### VSCode拡張機能

1. VSCode Marketplaceから「UiPath XAML Visualizer」をインストール
2. XAMLファイルを開くと自動的に有効化

### GitHub拡張機能（Chrome）

1. Chrome Web Storeから拡張機能をインストール
2. GitHubのXAMLファイルページでボタンが表示される

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
│   ├── azdo-extension/            # Azure DevOps拡張機能
│   │   ├── src/
│   │   │   ├── viewer.ts          # メインビューア
│   │   │   ├── viewer.html
│   │   │   ├── diff-viewer.ts     # 差分ビューア
│   │   │   └── diff-viewer.html
│   │   ├── package.json
│   │   ├── webpack.config.js
│   │   └── vss-extension.json
│   ├── vscode-extension/          # VSCode拡張機能
│   │   ├── src/
│   │   │   ├── extension.ts       # メインエントリー
│   │   │   ├── visualizerPanel.ts # ビジュアライザーパネル
│   │   │   └── diffPanel.ts       # 差分パネル
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── webpack.config.js
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

### 本番とテストの違い

#### 共通コード（両方で使用）
- `src/parser/` - XAML解析ロジック
- `src/renderer/` - ビジュアルレンダリングロジック
- `src/styles/` - CSS スタイル

#### 本番専用
- `src/viewer.ts` - Azure DevOps SDK を使用したファイル取得
- `src/diff-viewer.ts` - Azure DevOps 差分表示
- エントリーポイント: `viewer.ts`, `diff-viewer.ts`
- ビルド: `npm run build` (webpack.config.js)

#### テスト専用
- `src/test-viewer-standalone.ts` - 共通コードをブラウザに公開するラッパー
- `test/local-preview/viewer-test.html` - ローカルテスト用HTML（fetch API使用）
- エントリーポイント: `test-viewer-standalone.ts`
- ビルド: `npm run build:test` (webpack.test.config.js)

**ローカルテスト用サーバー起動:**
```bash
npm run build:test  # テスト用にビルド
npm run serve       # http://localhost:8080 でサーバー起動
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

## GitHub Pages

このリポジトリでは、`main`/`master`ブランチへのマージ時に、自動的にGitHub Pagesへデプロイされます。

- **公開ページ**: https://autofor.github.io/uipath-xaml-visualizer/

### ローカル開発環境

開発中の動作確認はローカルサーバーで行います：

```bash
npm run build:test  # テスト用にビルド
npm run serve       # http://localhost:8080 でサーバー起動
```

ブラウザで http://localhost:8080/test/local-preview/viewer-test.html にアクセスして動作確認できます。

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
- [Azure DevOps Extension SDK](https://github.com/microsoft/azure-devops-extension-sdk)
