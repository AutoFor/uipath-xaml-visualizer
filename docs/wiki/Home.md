# UiPath XAML Visualizer

## Overview
**UiPath XAML Visualizer** is a Chrome extension that displays UiPath workflow files (XAML) on GitHub in a visual, easy-to-read format.

Normally, UiPath workflow files appear as raw XML code on GitHub. With this extension, the workflow structure is rendered visually as a card-based diagram, making it easy to understand at a glance.

## このツールについて
**UiPath XAML Visualizer** は、GitHub 上で UiPath のワークフローファイル（XAML）を見やすく表示するための Chrome 拡張機能です。

通常、UiPath のワークフローファイルは XML 形式のコードとして表示されますが、この拡張機能を使うと、ワークフローの構造が図のように視覚的に表示されるため、直感的に内容を把握できます。

---

## Who is this for? | 誰のためのツール？

- **UiPath developers** | **UiPath 開発者**: Check workflow structure directly in the browser
- **Code reviewers** | **コードレビュアー**: Visually review XAML changes in pull requests
- **Project managers** | **プロジェクト管理者**: Quickly grasp the overall workflow structure

---

## Key Features | 主な特徴

| Feature | Description |
|---------|-------------|
| Visual display | Renders XAML code as a tree-based card view |
| Diff display | Highlights changes in PRs and commits |
| Screenshot display | Shows UiPath Informative Screenshots |
| Detail panel | Lists all properties of each activity |

| 機能 | 説明 |
|------|------|
| ビジュアル表示 | XAML コードをカード形式で見やすく表示 |
| 差分表示 | PR やコミットの変更箇所をハイライト表示 |
| スクリーンショット表示 | UiPath の Informative Screenshot を表示 |
| 詳細パネル | アクティビティのプロパティを一覧表示 |

---

## How to Use | 使い方

1. Install the extension from the Chrome Web Store
2. Open a `.xaml` file on GitHub
3. The visual display button appears automatically
4. Click the button to view the workflow visually

1. Chrome Web Store から拡張機能をインストール
2. GitHub 上の `.xaml` ファイルを開く
3. 自動的にビジュアル表示ボタンが表示される
4. ボタンをクリックして、ワークフローを視覚的に確認

---

## Related Pages | 関連ページ

- [Architecture](Architecture) - Overall structure and data flow of the extension
- [Specification](Specification) - Detailed feature specifications
- [Parser](Parser) - XAML parsing and diff calculation
- [Renderer](Renderer) - Activity rendering and property configuration
- [i18n](i18n) - Internationalization (EN/JA) implementation
- [GitHub-Extension](GitHub-Extension) - Detection, injection, and cursor sync flow
- [Property-System](Property-System) - Property display classification

---

- [アーキテクチャ](Architecture) - 拡張機能の全体構成とデータフロー
- [仕様書](Specification) - 機能の詳細な仕様
- [パーサー](Parser) - XAMLパースと差分計算
- [レンダラー](Renderer) - アクティビティレンダリングとプロパティ設定
- [i18n](i18n) - 国際化（EN/JA）実装
- [GitHub拡張機能](GitHub-Extension) - 検出・注入・カーソル同期フロー
- [プロパティの仕組み](Property-System) - プロパティ表示の分類
