# Specification | 仕様書

## System Overview | システム概要

UiPath XAML Visualizer is a Chrome extension (Manifest V3) that visually displays UiPath XAML files on GitHub.

UiPath XAML Visualizer は、Chrome 拡張機能（Manifest V3）として動作し、GitHub 上の UiPath XAML ファイルを視覚的に表示します。

### Architecture | アーキテクチャ

![Chrome Extension Architecture](images/chrome-extension-architecture.svg)

*[draw.io source](wiki-diagrams.drawio)*

## Package Structure | パッケージ構成

A monorepo consisting of the following 2 packages:

モノレポ構成で、以下の 2 パッケージから成ります。

| Package | Path | Description |
|---------|------|-------------|
| shared | `packages/shared/` | Common library for XAML parser and renderer |
| github-extension | `packages/github-extension/` | GitHub Chrome extension |

| パッケージ | パス | 説明 |
|-----------|------|------|
| shared | `packages/shared/` | XAML パーサー・レンダラーの共通ライブラリ |
| github-extension | `packages/github-extension/` | GitHub 用 Chrome 拡張機能 |

## Feature Specifications | 機能仕様

### 1. XAML Visual Display | XAMLビジュアル表示

Visually displays the workflow structure as a tree on GitHub's `.xaml` file pages.

GitHub 上の `.xaml` ファイルページにて、ワークフローの構造をツリー形式で視覚的に表示します。

**Target pages | 対象ページ:**
- File view pages (`github.com/<owner>/<repo>/blob/.../*.xaml`)
- ファイル閲覧ページ（`github.com/<owner>/<repo>/blob/.../*.xaml`）

**Display content | 表示内容:**
- Hierarchical structure of activities (tree view)
- Type-appropriate icons for each activity
- Activity property details (expanded on click)

- アクティビティの階層構造（ツリービュー）
- 各アクティビティの種類に応じたアイコン
- アクティビティのプロパティ詳細（クリックで展開）

### 2. Diff Visual Display | 差分ビジュアル表示

Visually highlights XAML file changes on PR and commit diff pages.

PR やコミットの差分ページにて、XAML ファイルの変更箇所を視覚的にハイライト表示します。

**Target pages | 対象ページ:**
- PR diff pages (`github.com/<owner>/<repo>/pull/<number>/files`)
- Commit diff pages (`github.com/<owner>/<repo>/commit/<sha>`)

- PR 差分ページ（`github.com/<owner>/<repo>/pull/<number>/files`）
- コミット差分ページ（`github.com/<owner>/<repo>/commit/<sha>`）

**Display content | 表示内容:**
- Added activities (green highlight)
- Removed activities (red highlight)
- Modified activities (yellow highlight)
- Before/after comparison view

- 追加されたアクティビティ（緑色ハイライト）
- 削除されたアクティビティ（赤色ハイライト）
- 変更されたアクティビティ（黄色ハイライト）
- 変更前・変更後の比較表示

> **Note | 注:** The previously displayed diff summary counter (Added / Removed / Modified count) has been removed. Changes can be confirmed directly via highlights on the workflow.
>
> 以前表示されていた差分サマリーカウンター（Added / Removed / Modified の件数表示）は廃止されました。差分はワークフロー上のハイライトで直接確認できます。

### 3. Screenshot Display | スクリーンショット表示

Displays screenshots saved with UiPath's Informative Screenshot feature.

UiPath の Informative Screenshot 機能で保存されたスクリーンショットを表示します。

### 4. Supported Activities | 対応アクティビティ

The following major UiPath activities are supported:

以下の主要な UiPath アクティビティに対応しています。

| Category | Activities |
|----------|-----------|
| Control flow | Sequence, Flowchart, StateMachine, If, Switch |
| Loops | While, DoWhile, ForEach, ParallelForEach |
| Data manipulation | Assign, AddToCollection, RemoveFromCollection |
| UI operations | Click, TypeInto, GetText, SetText |
| Logging / Notification | LogMessage, MessageBox |
| File invocation | InvokeWorkflowFile |
| Error handling | TryCatch, Throw, Rethrow |
| Other | Delay, Comment, Retry, and many more |

| カテゴリ | アクティビティ |
|---------|--------------|
| 制御フロー | Sequence, Flowchart, StateMachine, If, Switch |
| ループ | While, DoWhile, ForEach, ParallelForEach |
| データ操作 | Assign, AddToCollection, RemoveFromCollection |
| UI 操作 | Click, TypeInto, GetText, SetText |
| ログ・通知 | LogMessage, MessageBox |
| ファイル呼出 | InvokeWorkflowFile |
| エラー処理 | TryCatch, Throw, Rethrow |
| その他 | Delay, Comment, Retry 等多数 |

## Technical Specifications | 技術仕様

### Tech Stack | 技術スタック

| Technology | Purpose |
|------------|---------|
| TypeScript | Main development language |
| Chrome Extension API (Manifest V3) | Extension framework |
| Webpack | Bundler |
| Jest | Test framework |

| 技術 | 用途 |
|------|------|
| TypeScript | メイン開発言語 |
| Chrome Extension API (Manifest V3) | 拡張機能フレームワーク |
| Webpack | バンドラー |
| Jest | テストフレームワーク |

### Shared Library Main Modules | 共通ライブラリ（shared）の主要モジュール

| Module | File | Role |
|--------|------|------|
| XAML Parser | `xaml-parser.ts` | Parses XAML into an Activity tree |
| Diff Calculator | `diff-calculator.ts` | Computes diff between two XAMLs |
| Line Mapper | `line-mapper.ts` | Maps XAML line numbers to activities |
| Sequence Renderer | `sequence-renderer.ts` | Renders sequence structure |
| Tree View Renderer | `tree-view-renderer.ts` | Renders tree view |
| Diff Renderer | `diff-renderer.ts` | Renders diff display |
| Property Config | `property-config.ts` | Per-activity display property configuration |
| i18n | `i18n.ts` | Multilingual support |

| モジュール | ファイル | 役割 |
|-----------|---------|------|
| XAML パーサー | `xaml-parser.ts` | XAML を解析してアクティビティツリーを構築 |
| 差分計算 | `diff-calculator.ts` | 2 つの XAML を比較して差分を算出 |
| 行マッピング | `line-mapper.ts` | XAML 行番号とアクティビティの対応付け |
| シーケンスレンダラー | `sequence-renderer.ts` | シーケンス構造をレンダリング |
| ツリービューレンダラー | `tree-view-renderer.ts` | ツリービューをレンダリング |
| 差分レンダラー | `diff-renderer.ts` | 差分表示をレンダリング |
| プロパティ設定 | `property-config.ts` | アクティビティごとの表示プロパティ設定 |
| 国際化 | `i18n.ts` | 多言語対応 |

### Operating Environment | 動作環境

- Chrome browser (latest version recommended) | Chrome ブラウザ（最新版推奨）
- GitHub.com (operates on the github.com domain) | GitHub.com（github.com ドメイン上で動作）
