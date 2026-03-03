# Parser | パーサー

## Overview
The parser module converts UiPath XAML workflow files into structured data that the renderer can display.

## 概要
パーサーモジュールは、UiPath XAMLワークフローファイルをレンダラーが表示できる構造化データに変換します。

---

## Modules | モジュール

| Module | File | Role |
|--------|------|------|
| XAML Parser | `xaml-parser.ts` | Parses XAML text into an Activity tree |
| Diff Calculator | `diff-calculator.ts` | Computes diff between two Activity trees |
| Line Mapper | `line-mapper.ts` | Maps XAML line numbers to Activity keys |

| モジュール | ファイル | 役割 |
|-----------|---------|------|
| XAMLパーサー | `xaml-parser.ts` | XAMLテキストをActivityツリーに変換 |
| 差分計算 | `diff-calculator.ts` | 2つのActivityツリーの差分を計算 |
| 行マッパー | `line-mapper.ts` | XAML行番号をActivityキーにマッピング |

---

## XAML Parser | XAMLパーサー

### Overview
`XamlParser` parses UiPath XAML workflow text into a structured `Activity` tree (`ParsedXaml`).

### 概要
`XamlParser` は UiPath XAMLワークフローテキストを構造化された `Activity` ツリー（`ParsedXaml`）にパースします。

### Processing Flow | 処理フロー

**English**
1. Load XAML text
2. Parse DOM with `DOMParser` (`@xmldom/xmldom` for Node.js, browser native for Chrome extension)
3. Check for parse errors via `<parsererror>` element
4. Extract `Variable` list (elements with `x:TypeArguments` attribute)
5. Extract `Argument` list (`x:Property` elements)
6. Recursively parse root element as `Activity` tree
7. Flush log buffer to file (Node.js only)

**日本語**
1. XAMLテキストを受け取る
2. `DOMParser`でDOMを解析（Node.jsは`@xmldom/xmldom`、Chrome拡張はブラウザネイティブ）
3. `<parsererror>`要素でパースエラーをチェック
4. `Variable`リストを抽出（`x:TypeArguments`属性を持つ要素）
5. `Argument`リストを抽出（`x:Property`要素）
6. ルート要素を再帰的に`Activity`ツリーとしてパース
7. ログバッファをファイルにフラッシュ（Node.jsのみ）

### Key Types | 主要型

```typescript
interface Activity {
  id: string;           // Unique ID (activity-0, activity-1, ...)
  type: string;         // Activity type (Sequence, Assign, etc.)
  displayName: string;  // Display name from DisplayName attribute
  namespace?: string;   // Namespace prefix
  properties: Record<string, any>; // Properties map
  children: Activity[]; // Child activities
  annotations?: string; // Annotation text
  informativeScreenshot?: string; // Screenshot filename
}

interface ParsedXaml {
  rootActivity: Activity; // Root activity
  variables: Variable[];  // Variable list
  arguments: Argument[];  // Argument list
}
```

### Element Classification | 要素の分類

- **Wrapper elements** (transparent, recurse into children): `ActivityAction`, `ActivityAction.Argument`
- **Metadata elements** (excluded): Elements with `sap:`, `sap2010:`, `scg:`, `sco:`, `x:` prefix; `WorkflowViewStateService.ViewState`, `Dictionary`, `Variable`, etc.
- **Property elements** (stored as properties, not children): Elements with `.` in the name (e.g., `Assign.To`)
- **Activity elements**: Everything else

- **ラッパー要素**（透過的、子要素を再帰処理）: `ActivityAction`, `ActivityAction.Argument`
- **メタデータ要素**（除外）: `sap:`, `sap2010:`, `scg:`, `sco:`, `x:` プレフィックスの要素、`WorkflowViewStateService.ViewState`, `Dictionary`, `Variable`など
- **プロパティ要素**（子ではなくプロパティとして格納）: 名前に`.`を含む要素（例：`Assign.To`）
- **アクティビティ要素**: 上記以外すべて

---

## Diff Calculator | 差分計算

### Overview
`DiffCalculator` computes the difference between two `Activity` trees (before/after) and classifies changes as `ADDED`, `REMOVED`, or `MODIFIED`.

### 概要
`DiffCalculator` は2つの`Activity`ツリー（変更前/後）の差分を計算し、`ADDED`・`REMOVED`・`MODIFIED`に分類します。

### Activity Key | アクティビティキー

Activities are identified by a stable key (`buildActivityKey`):
- **Primary**: `sap2010:WorkflowViewState.IdRef` attribute (stable UUID from UiPath Studio)
- **Fallback**: `${type}_${displayName}_${index}` (positional, may be unstable if order changes)

アクティビティはキー（`buildActivityKey`）で識別されます：
- **優先**: `sap2010:WorkflowViewState.IdRef`属性（UiPath Studioが付与する安定したUUID）
- **フォールバック**: `${type}_${displayName}_${index}`（順序変更時に不安定になりうる）

### Ignored Properties | 無視プロパティ

Properties starting with `sap:` or `sap2010:` are excluded from diff calculation (UI layout metadata).

`sap:`または`sap2010:`で始まるプロパティは差分計算から除外されます（UIレイアウトメタデータ）。

### Diff Types | 差分タイプ

```typescript
enum DiffType {
  ADDED = 'added',
  REMOVED = 'removed',
  MODIFIED = 'modified'
}
```

---

## Line Mapper | 行マッパー

### Overview
`XamlLineMapper` scans XAML text line by line and builds a bidirectional index between Activity keys and XAML line numbers. This enables cursor synchronization between the visualizer panel and the GitHub code view.

### 概要
`XamlLineMapper` はXAMLテキストを行単位でスキャンし、アクティビティキーとXAML行番号の双方向インデックスを構築します。ビジュアライザーパネルとGitHubコードビューのカーソル同期に使用されます。

### Index Structure | インデックス構造

```typescript
interface ActivityLineIndex {
  keyToLines: Map<string, ActivityLineRange>; // Activity key -> line range
  lineToKey: Map<number, string>;             // Line number -> activity key
}

interface ActivityLineRange {
  activityKey: string; // Activity key
  displayName: string; // Display name
  type: string;        // Activity type
  startLine: number;   // Start line (1-based)
  endLine: number;     // End line (1-based)
}
```

### Algorithm | アルゴリズム

1. Split XAML text into lines
2. Extract XML tags from each line using a regex pattern
3. For self-closing tags: register immediately with `startLine = endLine = currentLine`
4. For open tags: push to a stack
5. For close tags: pop matching open tag from the stack, register with `startLine` from stack and `endLine = currentLine`

1. XAMLテキストを行に分割
2. 正規表現で各行からXMLタグを抽出
3. 自己閉じタグ: `startLine = endLine = 現在行`で即座に登録
4. 開始タグ: スタックにプッシュ
5. 閉じタグ: スタックから対応する開始タグをポップし、`startLine`をスタックから、`endLine`を現在行として登録

### Note on Key Consistency | キーの一貫性について

`XamlLineMapper` uses the same key generation logic as `buildActivityKey` in `diff-calculator.ts`. Both use `sap2010:WorkflowViewState.IdRef` as the primary key to ensure the cursor sync works reliably.

`XamlLineMapper` は `diff-calculator.ts` の `buildActivityKey` と同じキー生成ロジックを使用します。カーソル同期が正確に機能するよう、どちらも`sap2010:WorkflowViewState.IdRef`を主キーとして使用します。

---

## Related Files | 関連ファイル

| File | Role |
|------|------|
| `packages/shared/parser/xaml-parser.ts` | XAML parsing |
| `packages/shared/parser/diff-calculator.ts` | Diff calculation |
| `packages/shared/parser/line-mapper.ts` | Line number mapping |
| `packages/shared/index.ts` | Public exports |

## See Also | 関連ページ

- [Renderer](Renderer) - How parsed data is rendered to HTML
- [Architecture](Architecture) - Overall system architecture
