# GitHub Extension | GitHub拡張機能

## Overview
The GitHub Chrome extension (`packages/github-extension`) injects a visualizer panel into GitHub pages that contain UiPath XAML files. It detects the page type, fetches XAML content, and renders it using the shared parser and renderer modules.

## 概要
GitHub Chrome拡張機能（`packages/github-extension`）は、UiPath XAMLファイルを含むGitHubページにビジュアライザーパネルを注入します。ページタイプを検出し、XAMLコンテンツを取得して、共有パーサーとレンダラーモジュールを使用してレンダリングします。

---

## Entry Point | エントリーポイント

```
packages/github-extension/src/content.ts
```

This file is the Chrome extension content script that runs on GitHub pages.

このファイルはGitHubページで実行されるChrome拡張機能のコンテンツスクリプトです。

---

## Page Type Detection | ページタイプ検出

### `detectPageType(): PageType`

Detects which type of GitHub page is currently open by inspecting the URL:

現在開いているGitHubページのタイプをURLを検査して検出します：

| Page Type | URL Pattern | Description |
|-----------|-------------|-------------|
| `blob-xaml` | URL contains `.xaml` | Single XAML file view |
| `pr-diff` | `/pull/<n>/files` | PR diff page |
| `commit-diff` | `/commit/<sha>` or `/compare/` | Commit diff or compare page |
| `unknown` | (other) | Not a supported page |

| ページタイプ | URLパターン | 説明 |
|------------|------------|------|
| `blob-xaml` | URLに`.xaml`を含む | 単一XAMLファイル表示 |
| `pr-diff` | `/pull/<n>/files` | PR差分ページ |
| `commit-diff` | `/commit/<sha>`または`/compare/` | コミット差分またはCompareページ |
| `unknown` | (その他) | サポート外のページ |

---

## Visualizer Panel Injection | ビジュアライザーパネルの注入

### `displayBlobVisualizerPanel(workflowData, lineIndex?, screenshotResolver?)`

Renders the main visualizer panel for a single XAML file view:

単一XAMLファイル表示のメインビジュアライザーパネルをレンダリングします：

1. Creates a floating panel on the right side of the screen
2. Renders a `SequenceRenderer` view of the parsed XAML
3. Optionally adds a `TreeViewRenderer` panel
4. Sets up cursor sync between the visualizer and GitHub's code view

1. 画面右側にフローティングパネルを作成
2. パースされたXAMLの`SequenceRenderer`ビューをレンダリング
3. オプションで`TreeViewRenderer`パネルを追加
4. ビジュアライザーとGitHubのコードビュー間のカーソル同期を設定

---

## Cursor Synchronization | カーソル同期

### `setupCursorSync(lineIndex: ActivityLineIndex)`

Bidirectional sync between the visualizer panel and GitHub's code diff view:

ビジュアライザーパネルとGitHubのコード差分ビュー間の双方向同期：

**Visualizer → Code view:**
- Listens to `visualizer-line-click` CustomEvent from activity card line badges
- Scrolls GitHub's code view to the corresponding line number

**ビジュアライザー → コードビュー:**
- アクティビティカード行バッジからの`visualizer-line-click` CustomEventを受信
- GitHubのコードビューを対応する行番号にスクロール

**Code view → Visualizer:**
- Uses `MutationObserver` to watch for GitHub's cursor line highlight changes
- When a code line is highlighted, finds the corresponding activity card and scrolls to it

**コードビュー → ビジュアライザー:**
- GitHubのカーソル行ハイライト変更を`MutationObserver`で監視
- コード行がハイライトされると、対応するアクティビティカードを見つけてスクロール

---

## Language Toggle | 言語切り替え

The panel header includes a language toggle button (EN / JA). When clicked:

パネルヘッダーには言語切り替えボタン（EN / JA）があります。クリック時：

1. Saves new language to `chrome.storage.sync` (synced across devices)
2. Calls `setLanguage(lang)` from the shared i18n module
3. Re-renders the current panel (`reRenderCurrentPanel()`)

1. 新しい言語を`chrome.storage.sync`に保存（デバイス間で同期）
2. 共有i18nモジュールの`setLanguage(lang)`を呼び出す
3. 現在のパネルを再レンダリング（`reRenderCurrentPanel()`）

On page load, the saved language preference is loaded from `chrome.storage.sync` before the first render.

ページ読み込み時、最初のレンダリング前に`chrome.storage.sync`から保存済みの言語設定を読み込みます。

---

## PR / Commit Diff Flow | PR/コミット差分フロー

For PR diff and commit diff pages:

PR差分およびコミット差分ページの場合：

1. Detect XAML files in the diff by scanning `<a>` links or the diff file list
2. For each XAML file, add a "View Visualizer" button next to the file header
3. When clicked, fetch both versions of the XAML (base + head) via GitHub raw URLs
4. Parse both versions with `XamlParser`
5. Build `ActivityLineIndex` for both versions with `XamlLineMapper`
6. Compute diff with `DiffCalculator`
7. Render with `DiffRenderer`

1. `<a>`リンクや差分ファイルリストをスキャンしてXAMLファイルを検出
2. 各XAMLファイルのファイルヘッダー隣に「ビジュアライザーを表示」ボタンを追加
3. クリック時、GitHubのraw URLでXAMLの両バージョン（ベース + ヘッド）を取得
4. `XamlParser`で両バージョンをパース
5. `XamlLineMapper`で両バージョンの`ActivityLineIndex`を構築
6. `DiffCalculator`で差分を計算
7. `DiffRenderer`でレンダリング

### SHA Resolution | SHA解決

The extension extracts base/head commit SHAs from the GitHub page's embedded JSON data. It tries multiple patterns:
- `baseRefOid` / `headRefOid` (GitHub React embedded data)
- `baseSha` / `headSha`
- Fallback: hidden `<input>` elements with `comparison_start_oid` / `comparison_end_oid`

拡張機能はGitHubページの埋め込みJSONデータからベース/ヘッドコミットSHAを抽出します。複数のパターンを試みます：
- `baseRefOid` / `headRefOid`（GitHub React埋め込みデータ）
- `baseSha` / `headSha`
- フォールバック: `comparison_start_oid` / `comparison_end_oid` を持つ非表示`<input>`要素

---

## Screenshot URL Resolution | スクリーンショットURL解決

`createScreenshotResolver(owner, repo, sha)` creates a resolver that maps screenshot filenames to GitHub raw URLs:

```
https://github.com/{owner}/{repo}/raw/{sha}/.screenshots/{filename}
```

Screenshots are stored in the `.screenshots/` directory in the repository root.

スクリーンショットはリポジトリルートの`.screenshots/`ディレクトリに保存されます。

---

## URL Change Detection | URL変更検出

GitHub is a single-page application (SPA). The extension uses a `MutationObserver` on `document.body` to detect URL changes and re-run the injection logic when navigation occurs.

GitHubはシングルページアプリケーション（SPA）です。拡張機能は`document.body`の`MutationObserver`を使用してURL変更を検出し、ナビゲーション時に注入ロジックを再実行します。

---

## Build Output | ビルド出力

```
packages/github-extension/dist/
├── content.js     # Bundled content script
├── popup.html     # Extension popup
├── popup.js       # Popup script
└── manifest.json  # Extension manifest (Manifest V3)
```

---

## Related Files | 関連ファイル

| File | Role |
|------|------|
| `packages/github-extension/src/content.ts` | Main content script |
| `packages/github-extension/manifest.json` | Extension manifest |
| `packages/shared/styles/github-panel.css` | Panel styles |

## See Also | 関連ページ

- [Architecture](Architecture) - Overall system architecture
- [i18n](i18n) - Language toggle and persistence
- [Parser](Parser) - XAML parsing
- [Renderer](Renderer) - Panel rendering
