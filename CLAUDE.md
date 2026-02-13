# UiPath XAML Visualizer プロジェクトルール

## 📖 プロジェクト概要

GitHub上のUiPath XAMLワークフローファイルを視覚的に表示するChrome拡張機能です。

### 主な機能
- GitHub上のXAMLファイルをビジュアル表示
- PRやコミット差分のビジュアル差分表示
- Chrome拡張機能として動作

---

## 🛠️ 技術スタック

- **言語**: TypeScript
- **フレームワーク**: Chrome Extension API (Manifest V3)
- **対応フォーマット**: UiPath XAML
- **ビルドツール**: npm, webpack

---

## 📁 ファイル構造

```
uipath-xaml-visualizer/
├── packages/
│   ├── shared/                # 共通ライブラリ（パーサー・レンダラー）
│   └── github-extension/      # GitHub Chrome拡張機能
├── test/                      # テストファイル
├── .claude/                   # Claude Code 設定
├── CLAUDE.md                  # このファイル
├── package.json               # ルートパッケージ（モノレポ）
└── README.md                  # プロジェクト説明
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
- `/dev-build` - 開発ビルド（Windows固定パスに出力）

### 実装完了時のルール

コードの実装が完了したら、必ず `/dev-build` スキルを実行してChrome拡張機能の開発ビルドを行うこと。
