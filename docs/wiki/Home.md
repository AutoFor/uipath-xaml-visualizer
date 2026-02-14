# UiPath XAML Visualizer - 開発イメージ整理

## この拡張機能が解決する課題

UiPath Studio で作成されるワークフローファイル（`.xaml`）は、実体が数百〜数千行の XML です。

GitHub の PR でこの `.xaml` ファイルの diff を見ても、以下の問題があります:

- **XML の生テキスト diff は読めない**: タグの入れ子、名前空間、ViewState が大量に含まれ、「何が変わったか」を把握するのが困難
- **DisplayName が埋もれる**: レビュアーが気にする「どのアクティビティが変わったか」が、XML の中に埋もれてしまう
- **構造の変更が見えない**: アクティビティの追加・削除・移動が、行の増減だけでは判断しにくい

## この拡張機能でやりたいこと

GitHub の PR レビューを「ワークフロー構造ベース」で行えるようにする。

### 機能一覧

| 機能 | 概要 | 詳細 |
|------|------|------|
| **差分ビジュアライズ** | 追加・削除・変更をカード形式で色分け表示 | [Feature Guide](./Feature-Guide.md#差分ビジュアライズ) |
| **DisplayName ベースの表示** | `type: DisplayName` 形式で各アクティビティを表示 | [Feature Guide](./Feature-Guide.md#displayname-表示) |
| **行番号バッジ** | 各カードに `L45-L67` のバッジを表示 | [Feature Guide](./Feature-Guide.md#行番号バッジ) |
| **カーソル位置同期** | Visualizer と Raw XAML を双方向でハイライト連動 | [Feature Guide](./Feature-Guide.md#カーソル位置同期) |
| **レビューコメント連携** | Visualizer 上でコメントの閲覧・投稿 | [Feature Guide](./Feature-Guide.md#レビューコメント連携) |
| **DisplayName 検索** | Ctrl+F でワークフロー内をインクリメンタル検索 | [Feature Guide](./Feature-Guide.md#displayname-検索) |

## PR レビューの全体イメージ

```
開発者: UiPath Studio でワークフロー編集 → コミット → PR 作成
             ↓
レビュアー: PR の File Changes を開く
             ↓
          「View as Workflow」ボタンをクリック
             ↓
          差分サマリーで全体像を把握（追加 N / 削除 N / 変更 N）
             ↓
          DisplayName で変更箇所を特定
             ↓
          行番号バッジで Raw XAML と照合
             ↓
          Visualizer 上 or Raw XAML 上でレビューコメント投稿
```

詳しいフローは [PR Review Workflow](./PR-Review-Workflow.md) を参照。

## Wiki ページ一覧

| ページ | 内容 |
|--------|------|
| [PR Review Workflow](./PR-Review-Workflow.md) | PR レビューの全体フロー（開発者側・レビュアー側） |
| [Feature Guide](./Feature-Guide.md) | 各機能の使い方イメージ |
| [Tips and Best Practices](./Tips-and-Best-Practices.md) | DisplayName 検索のコツ、レビュー手法 |
