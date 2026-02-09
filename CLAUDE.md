# UiPath XAML Visualizer プロジェクトルール

## 📖 プロジェクト概要

UiPath の XAML ワークフローファイルをビジュアル化するツールです。

### 主な機能
- XAML ワークフローの構造を視覚的に表示
- VSCode 拡張機能として動作
- リアルタイムプレビュー

---

## 🛠️ 技術スタック

- **言語**: TypeScript
- **フレームワーク**: VSCode Extension API
- **対応フォーマット**: UiPath XAML
- **ビルドツール**: npm, webpack

---

## 📁 ファイル構造

```
uipath-github-xaml-visualizer/
├── docs/                    # ドキュメント
├── src/                     # ソースコード
│   ├── shared/             # 共通ライブラリ
│   ├── extension/          # VSCode拡張機能
│   │   ├── extension.ts   # エントリーポイント
│   │   └── preview/       # プレビュー機能
│   └── server/            # プレビューサーバー
├── test/                   # テストファイル
│   └── projects/          # テスト用XAMLプロジェクト
├── .claude/               # Claude Code 設定
├── CLAUDE.md             # このファイル
├── package.json          # npm設定
└── README.md             # プロジェクト説明
```

---

## 🚀 開発コマンド

### ビルド
```bash
npm install                    # 依存関係インストール
npm run build:shared          # 共通ライブラリビルド
npm run build                 # 全体ビルド
```

### テスト
```bash
npm test                      # テスト実行
```

### 開発
```bash
npm run watch                 # 開発モード（自動リビルド）
```

---

## 📋 GitHub リポジトリ情報

- **Owner**: AutoFor
- **Repository**: uipath-xaml-visualizer
- **Base Branch**: master

---

## 💡 プロジェクト固有のルール

### XAML パース
- UiPath 固有の XAML 要素を正しく認識する
- 名前空間の扱いに注意（`xmlns:ui`, `xmlns:sap` など）

### プレビュー表示
- ワークフローの階層構造を維持して表示
- アクティビティの種類ごとに適切なアイコンを表示

---

## 📚 共通ルール

Git Worktree 運用、GitHub PR/Issue フロー、コーディング規約などの共通ルールは、グローバル設定（`~/.claude/CLAUDE.md`）を参照してください。

利用可能なスキル：
- `/git-worktree-branch` - ブランチ作成
- `/github-finish` - 作業完了フロー
- `/japanese-comments` - 日本語コメント追加
