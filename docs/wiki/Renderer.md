# Renderer | レンダラー

## Overview
The renderer module converts parsed `Activity` tree data into HTML elements displayed in the visualizer panel.

## 概要
レンダラーモジュールは、パース済みの`Activity`ツリーデータをビジュアライザーパネルに表示するHTML要素に変換します。

---

## Modules | モジュール

| Module | File | Role |
|--------|------|------|
| Sequence Renderer | `sequence-renderer.ts` | Renders Activity tree as card-based UI |
| Diff Renderer | `diff-renderer.ts` | Renders diff result with added/removed/modified badges |
| Tree View Renderer | `tree-view-renderer.ts` | Renders Activity tree as collapsible tree |
| Property Config | `property-config.ts` | Configures which properties to show where |

| モジュール | ファイル | 役割 |
|-----------|---------|------|
| シーケンスレンダラー | `sequence-renderer.ts` | Activityツリーをカード形式でレンダリング |
| 差分レンダラー | `diff-renderer.ts` | 追加/削除/変更バッジ付きで差分をレンダリング |
| ツリービューレンダラー | `tree-view-renderer.ts` | Activityツリーを折りたたみツリーでレンダリング |
| プロパティ設定 | `property-config.ts` | どのプロパティをどこに表示するかを設定 |

---

## Sequence Renderer | シーケンスレンダラー

### Overview
`SequenceRenderer` renders a parsed XAML workflow as a series of activity cards with collapsible children.

### 概要
`SequenceRenderer` はパース済みXAMLワークフローを、子要素を折りたたみ可能なアクティビティカードの連続として表示します。

### Activity Card Structure | アクティビティカード構造

```
┌─────────────────────────────────────────────┐
│ [▼] [Activity Type]: [Display Name]  [L:10] │  ← Header (collapse btn, title, line badge)
│─────────────────────────────────────────────│
│ [Annotation text if present]                │  ← Annotation (optional)
│─────────────────────────────────────────────│
│ property-key: property-value                │  ← Main properties
│─────────────────────────────────────────────│
│ [Properties ▶]                              │  ← Sub-panel toggle (optional)
│  ┌─ Target ──────────────────────┐          │
│  │ FullSelectorArgument: ...     │          │
│  │ ObjectRepository: Linked      │          │
│  └───────────────────────────────┘          │
│─────────────────────────────────────────────│
│ [Screenshot image]                          │  ← InformativeScreenshot (optional)
│─────────────────────────────────────────────│
│  ┌─ Child Activity ───────────┐             │
│  │   ...                     │             │
│  └───────────────────────────┘             │
└─────────────────────────────────────────────┘
```

### Rendering by Activity Type | アクティビティタイプ別レンダリング

| Activity | Main display |
|----------|-------------|
| `Assign` | `To = Value` expression format |
| `MultipleAssign` | List of `To = Value` expressions |
| `NApplicationCard` | URL from `TargetApp.Url` |
| `LogMessage` | `Level` and `Message` properties |
| `NClick`, `NTypeInto`, etc. | Properties defined in `ACTIVITY_CONFIGS.mainProperties` |
| Undefined activities | No properties shown |

| アクティビティ | メイン表示 |
|--------------|----------|
| `Assign` | `To = Value` の代入式形式 |
| `MultipleAssign` | `To = Value` 式のリスト |
| `NApplicationCard` | `TargetApp.Url` からのURL |
| `LogMessage` | `Level`と`Message`プロパティ |
| `NClick`, `NTypeInto`など | `ACTIVITY_CONFIGS.mainProperties`で定義されたプロパティ |
| 未定義アクティビティ | プロパティ非表示 |

### Screenshot Path Resolution | スクリーンショットパス解決

`SequenceRenderer` accepts an optional `ScreenshotPathResolver` function in its constructor. This allows the GitHub extension to resolve screenshot paths relative to the repository.

`SequenceRenderer`はコンストラクタにオプションの`ScreenshotPathResolver`関数を受け取ります。これにより、GitHub拡張機能がリポジトリ相対のスクリーンショットパスを解決できます。

### Cursor Sync Integration | カーソル同期連携

Each activity card's header includes a line number badge (e.g., `L10` or `L10-L25`). Clicking the badge fires a `visualizer-line-click` CustomEvent with `{ activityKey, startLine, endLine }` which the content script listens to for cursor sync.

各アクティビティカードのヘッダーには行番号バッジ（例：`L10`や`L10-L25`）が表示されます。バッジをクリックすると`{ activityKey, startLine, endLine }`を持つ`visualizer-line-click` CustomEventが発火し、コンテンツスクリプトがカーソル同期のために受信します。

---

## Diff Renderer | 差分レンダラー

### Overview
`DiffRenderer` renders a `DiffResult` (from `DiffCalculator`) as a list of diff cards. Each card shows a badge (`Added`, `Removed`, or `Modified`) and highlights changed property values at the word level.

### 概要
`DiffRenderer` は`DiffCalculator`からの`DiffResult`を差分カードのリストとしてレンダリングします。各カードはバッジ（`Added`、`Removed`、または`Modified`）を表示し、変更されたプロパティ値をワードレベルでハイライトします。

### Word-Level Diff | ワードレベル差分

The `buildWordDiffHtml` method computes character-level differences between before/after values and wraps changed characters in `<span class="word-highlight">`. A similarity threshold of 50% is used: if two strings share less than 50% of characters in common, the entire string is highlighted (to avoid spurious partial matches in hashes or selectors).

`buildWordDiffHtml`メソッドは変更前/後の値の文字レベル差分を計算し、変更された文字を`<span class="word-highlight">`で囲みます。類似度50%の閾値を使用：2つの文字列が50%未満の共通文字しか持たない場合、文字列全体をハイライトします（ハッシュやセレクターの偶然の部分一致を防ぐため）。

---

## Tree View Renderer | ツリービューレンダラー

### Overview
`TreeViewRenderer` renders the Activity tree as a collapsible tree, similar to a file tree. Clicking a label scrolls the main sequence view to the corresponding activity card and highlights it.

### 概要
`TreeViewRenderer` はActivityツリーをファイルツリーに似た折りたたみツリーとしてレンダリングします。ラベルをクリックすると、メインのシーケンスビューが対応するアクティビティカードにスクロールしてハイライトします。

---

## Property Config | プロパティ設定

### Overview
`property-config.ts` defines per-activity configurations for which properties to show in the main area vs. the collapsible sub-panel. See [Property-System](Property-System) for full details.

### 概要
`property-config.ts` はアクティビティごとに、どのプロパティをメインエリアに表示するか、折りたたみサブパネルに表示するかを設定します。詳細は[プロパティの仕組み](Property-System)を参照してください。

### Key Functions | 主要関数

| Function | Description |
|----------|-------------|
| `getActivityPropertyConfig(type)` | Returns `ActivityPropertyConfig` for the given type |
| `getSubProperties(props, type)` | Extracts sub-panel properties (excludes main + hidden) |
| `isHiddenProperty(name)` | Returns true for metadata properties (`sap:*`, `xmlns*`, etc.) |
| `hasSubPanel(type)` | Returns false for Assign/MultipleAssign (dedicated rendering) |
| `isDefinedActivity(type)` | Returns true if the activity has defined rendering |
| `categorizeDiffChanges(changes, type)` | Splits diff changes into main/sub for diff renderer |

| 関数 | 説明 |
|------|------|
| `getActivityPropertyConfig(type)` | 指定タイプの`ActivityPropertyConfig`を返す |
| `getSubProperties(props, type)` | サブパネルプロパティを抽出（メイン・非表示を除外） |
| `isHiddenProperty(name)` | メタデータプロパティ（`sap:*`、`xmlns*`など）でtrueを返す |
| `hasSubPanel(type)` | Assign/MultipleAssignはfalse（専用レンダリング） |
| `isDefinedActivity(type)` | アクティビティが定義済みレンダリングを持つ場合true |
| `categorizeDiffChanges(changes, type)` | 差分変更をメイン/サブに分類（差分レンダラー用） |

---

## Related Files | 関連ファイル

| File | Role |
|------|------|
| `packages/shared/renderer/sequence-renderer.ts` | Sequence rendering |
| `packages/shared/renderer/diff-renderer.ts` | Diff rendering |
| `packages/shared/renderer/tree-view-renderer.ts` | Tree view rendering |
| `packages/shared/renderer/property-config.ts` | Property configuration |

## See Also | 関連ページ

- [Parser](Parser) - How XAML is parsed into Activity trees
- [Property-System](Property-System) - Detailed property classification rules
- [Architecture](Architecture) - Overall system architecture
