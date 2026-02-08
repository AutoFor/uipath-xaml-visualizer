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
│   ├── parser/              # XAMLパーサー（本番・テスト共通）
│   │   ├── xaml-parser.ts   # XAML解析
│   │   └── diff-calculator.ts # 差分計算
│   ├── renderer/            # レンダラー（本番・テスト共通）
│   │   ├── sequence-renderer.ts  # Sequenceレンダリング
│   │   ├── tree-view-renderer.ts # ツリービュー
│   │   └── diff-renderer.ts      # 差分表示
│   ├── styles/              # スタイルシート（本番・テスト共通）
│   │   ├── main.css         # メインスタイル
│   │   └── diff.css         # 差分表示スタイル
│   ├── viewer.ts            # 本番用エントリーポイント（Azure DevOps拡張機能）
│   ├── viewer.html          # 本番用HTML
│   ├── diff-viewer.ts       # 差分ビューアメイン（本番用）
│   ├── diff-viewer.html     # 差分ビューアHTML（本番用）
│   └── test-viewer-standalone.ts # テスト用エントリーポイント（ローカル開発）
├── test/
│   ├── local-preview/       # ローカルテスト環境
│   │   ├── viewer-test.html # テスト用HTML（スタンドアロン）
│   │   └── test-viewer.js   # ビルド済みテストビューア
│   └── projects/
│       └── sample/          # サンプルXAMLプロジェクト
│           ├── Main.xaml
│           └── .screenshots/ # スクリーンショット画像
├── dist/                    # ビルド結果
├── spec.md                  # プロジェクト仕様書
├── package.json
├── tsconfig.json
├── webpack.config.js        # 本番用ビルド設定
├── webpack.test.config.js   # テスト用ビルド設定
└── vss-extension.json       # Azure DevOps拡張機能マニフェスト
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

## 開発用プレビューページ（CI専用）

このリポジトリでは、`dev`や`feature`ブランチへのpush時に、自動的に開発用GitHub Pagesへデプロイされます。

### アクセス方法

- **開発用ページ**: https://autofor.github.io/uipath-xaml-visualizer/dev/
- **本番用ページ**: https://autofor.github.io/uipath-xaml-visualizer/

### 特徴

- **プルリク不要**: dev/featureブランチへpushするだけで自動デプロイ
- **目視確認**: 最新の開発成果をブラウザで即座に確認可能
- **承認フロー**: レビュー担当者が開発用ページで動作確認
- **本番分離**: 本番環境（main/masterブランチ）とは完全に分離

### 運用フロー

1. dev/featureブランチで開発
2. pushすると自動的に開発用Pagesへデプロイ
3. デプロイされたページで動作確認・目視チェック
4. 問題なければmainブランチへマージ
5. 本番用Pagesへ自動デプロイ

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
