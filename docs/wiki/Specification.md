# 仕様書

## システム概要

UiPath XAML Visualizer は、Chrome 拡張機能（Manifest V3）として動作し、GitHub 上の UiPath XAML ファイルを視覚的に表示します。

### アーキテクチャ

```
┌─────────────────────────────────────────┐
│           Chrome 拡張機能                │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │ Content      │  │ Background       │  │
│  │ Script       │  │ Script           │  │
│  │ (content.ts) │  │ (background.ts)  │  │
│  └──────┬──────┘  └──────────────────┘  │
│         │                                │
│  ┌──────▼──────────────────────────────┐ │
│  │         共通ライブラリ (shared)      │ │
│  │  ┌──────────┐  ┌────────────────┐  │ │
│  │  │ Parser   │  │ Renderer       │  │ │
│  │  │ ・XAML解析│  │ ・ツリー表示   │  │ │
│  │  │ ・差分計算│  │ ・差分表示     │  │ │
│  │  │ ・行マップ│  │ ・シーケンス   │  │ │
│  │  └──────────┘  └────────────────┘  │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## パッケージ構成

モノレポ構成で、以下の 2 パッケージから成ります。

| パッケージ | パス | 説明 |
|-----------|------|------|
| shared | `packages/shared/` | XAML パーサー・レンダラーの共通ライブラリ |
| github-extension | `packages/github-extension/` | GitHub 用 Chrome 拡張機能 |

## 機能仕様

### 1. XAML ビジュアル表示

GitHub 上の `.xaml` ファイルページにて、ワークフローの構造をツリー形式で視覚的に表示します。

**対象ページ:**
- ファイル閲覧ページ（`github.com/<owner>/<repo>/blob/.../*.xaml`）

**表示内容:**
- アクティビティの階層構造（ツリービュー）
- 各アクティビティの種類に応じたアイコン
- アクティビティのプロパティ詳細（クリックで展開）

### 2. 差分ビジュアル表示

PR やコミットの差分ページにて、XAML ファイルの変更箇所を視覚的にハイライト表示します。

**対象ページ:**
- PR 差分ページ（`github.com/<owner>/<repo>/pull/<number>/files`）
- コミット差分ページ（`github.com/<owner>/<repo>/commit/<sha>`）

**表示内容:**
- 追加されたアクティビティ（緑色ハイライト）
- 削除されたアクティビティ（赤色ハイライト）
- 変更されたアクティビティ（黄色ハイライト）
- 変更前・変更後の比較表示

### 3. スクリーンショット表示

UiPath の Informative Screenshot 機能で保存されたスクリーンショットを表示します。

### 4. 対応アクティビティ

以下の主要な UiPath アクティビティに対応しています。

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

## 技術仕様

### 技術スタック

| 技術 | 用途 |
|------|------|
| TypeScript | メイン開発言語 |
| Chrome Extension API (Manifest V3) | 拡張機能フレームワーク |
| Webpack | バンドラー |
| Jest | テストフレームワーク |

### 共通ライブラリ（shared）の主要モジュール

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

### 動作環境

- Chrome ブラウザ（最新版推奨）
- GitHub.com（github.com ドメイン上で動作）
