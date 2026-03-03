---
name: wiki-write
description: このプロジェクトのWikiページを英語・日本語バイリンガル形式で書く。「Wikiを書いて」「Wikiを更新して」と言ったときに使用します。
disable-model-invocation: false
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
---

# Wiki バイリンガル執筆スキル

このプロジェクトの `docs/wiki/` に置くMarkdownページを、英語・日本語併記のバイリンガル形式で書く。

---

## フォーマットルール

### ルール1: ページタイトル

```markdown
# English Title | 日本語タイトル
```

英語タイトルを先に書き、`|` で区切って日本語タイトルを書く。

---

### ルール2: 概要セクション

英語の `## Overview` → 日本語の `## 概要` の順に並べる。

```markdown
## Overview
One or two sentences summarizing what this module does.

## 概要
このモジュールが何をするかを1〜2文で説明します。
```

---

### ルール3: セクション見出し

`## English | 日本語` 形式。内容が短い場合はそのまま英語・日本語を続けて書く。

```markdown
## Modules | モジュール

| Module | File | Role |
|--------|------|------|
| XAML Parser | `xaml-parser.ts` | Parses XAML text into an Activity tree |

| モジュール | ファイル | 役割 |
|-----------|---------|------|
| XAMLパーサー | `xaml-parser.ts` | XAMLテキストをActivityツリーに変換 |
```

テーブルは EN テーブル → JA テーブルの順で並べる。

---

### ルール4: 手順・リストが長い場合

`**English**` / `**日本語**` ラベルを使ってブロックを分ける。

```markdown
### Processing Flow | 処理フロー

**English**
1. Load XAML text
2. Parse DOM with `DOMParser`
3. Recursively extract Activity tree

**日本語**
1. XAMLテキストを受け取る
2. `DOMParser` でDOMを解析
3. Activityツリーを再帰的に抽出
```

---

### ルール5: コードブロック

コードブロックは共通（言語に依存しない）なので、EN/JA セクションの間に一度だけ置く。コメントは英語で書く。

```markdown
### Key Types | 主要型

```typescript
interface Activity {
  id: string;           // Unique ID (activity-0, activity-1, ...)
  type: string;         // Activity type (Sequence, Assign, etc.)
  displayName: string;  // Display name shown in the UI
  children: Activity[]; // Child activities
}
```
```

---

### ルール6: セクション間の区切り

大きなセクションの切れ目には `---` を入れる。

```markdown
---

## Next Section | 次のセクション
```

---

### ルール7: See Also（参照）セクション

ページ末尾に他のWikiページへのリンクを置く。

```markdown
---

## See Also | 関連ページ

- [Renderer | レンダラー](Renderer)
- [i18n | 国際化](i18n)
- [Architecture | アーキテクチャ](Architecture)
```

---

## NG パターン（やってはいけない書き方）

### NG1: 英語だけ or 日本語だけ

```markdown
<!-- NG: 英語しかない -->
## Overview
This module parses XAML files.

<!-- NG: 日本語しかない -->
## 概要
このモジュールはXAMLファイルをパースします。
```

```markdown
<!-- OK: 両方ある -->
## Overview
This module parses XAML files.

## 概要
このモジュールはXAMLファイルをパースします。
```

---

### NG2: EN/JA が混在した文章

```markdown
<!-- NG: 1文の中に日英混在 -->
`XamlParser` は XAML text を Activity tree に変換します。

<!-- OK: 英語文・日本語文を別々に -->
`XamlParser` converts XAML text into an Activity tree.

`XamlParser` は XAMLテキストを Activityツリーに変換します。
```

---

### NG3: タイトルが日本語だけ

```markdown
<!-- NG -->
## XAMLパーサー

<!-- OK -->
## XAML Parser | XAMLパーサー
```

---

### NG4: コードコメントに日本語

```markdown
<!-- NG -->
```typescript
id: string;  // ユニークID
```

<!-- OK -->
```typescript
id: string;  // Unique ID
```
```

---

### NG5: テーブルを1つにまとめる（EN/JA 混在列）

```markdown
<!-- NG: 1つのテーブルにEN/JAを混在させる -->
| Module / モジュール | Role / 役割 |
|---------------------|------------|
| XamlParser / XAMLパーサー | Parse / パース |

<!-- OK: ENテーブルとJAテーブルを分ける -->
| Module | Role |
|--------|------|
| XamlParser | Parses XAML text |

| モジュール | 役割 |
|-----------|------|
| XAMLパーサー | XAMLテキストをパース |
```

---

## 実際のページ例（抜粋）

`docs/wiki/Parser.md` の冒頭：

```markdown
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

| モジュール | ファイル | 役割 |
|-----------|---------|------|
| XAMLパーサー | `xaml-parser.ts` | XAMLテキストをActivityツリーに変換 |
| 差分計算 | `diff-calculator.ts` | 2つのActivityツリーの差分を計算 |

---

## XAML Parser | XAMLパーサー

### Overview
`XamlParser` parses UiPath XAML workflow text into a structured `Activity` tree.

### 概要
`XamlParser` は UiPath XAMLワークフローテキストを構造化された `Activity` ツリーにパースします。

### Processing Flow | 処理フロー

**English**
1. Load XAML text
2. Parse DOM with `DOMParser`
3. Recursively parse root element as `Activity` tree

**日本語**
1. XAMLテキストを受け取る
2. `DOMParser` でDOMを解析
3. ルート要素を再帰的に `Activity` ツリーとしてパース
```

---

## Wiki作成・更新後の手順

ページを書いたら、以下のコマンドでGitHub Wikiに反映する：

```bash
# コミット＆プッシュ
git add docs/wiki/
git commit -m "docs: <ページ名> Wiki を追加/更新"
git push

# wiki-sync ワークフローを手動実行（masterへのpushでも自動実行される）
gh workflow run wiki-sync.yml --ref <現在のブランチ名>
```

新規ページを追加した場合は `docs/wiki/_Sidebar.md` にもリンクを追加すること：

```markdown
- [New Page | 新ページ](New-Page)
```
