---
name: github-finish
description: UiPath XAML Visualizer プロジェクトで作業（テーマ）完了時に行う GitHub PR と Issue の標準フロー。ユーザーが「作業が完了した」「PRを作成したい」「テーマが終わった」と言ったときに使用します。
disable-model-invocation: false
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - mcp__github__create_pull_request
  - mcp__github__issue_write
  - mcp__github__update_pull_request
  - mcp__github__merge_pull_request
  - mcp__github__get_me
---

# GitHub 作業完了フロースキル

このスキルは、`uipath-github-xaml-visualizer` プロジェクトで作業（テーマ）が完了したときの標準的な GitHub 運用手順を提供します。

## 前提条件の確認

以下を確認してから手順を開始する：

- ✅ 作業ブランチに必要なコミットがすべて含まれている
- ✅ リモートリポジトリに `git push` 済みである
- ✅ コードが正常に動作する

## 作業完了後の必須手順

**必ず以下の順序で実行する：**

### 1. プルリクエスト（PR）作成

GitHub の MCP ツールまたは `gh` コマンドで PR を作成する。

**MCPツール使用例:**
```
mcp__github__create_pull_request を使用
- owner: AutoFor
- repo: uipath-xaml-visualizer
- title: [作業内容を簡潔に記載]
- body: [変更内容の詳細]
- head: [作業ブランチ名]
- base: master
```

**gh コマンド例:**
```bash
gh pr create --title "機能追加: XAMLビジュアライザー改善" --body "詳細な変更内容"
```

**PR作成時のポイント:**
- タイトルは簡潔で分かりやすく（50文字以内推奨）
- 本文には変更の背景、実装内容、テスト結果を記載
- スクリーンショットやコード例があれば追加

### 2. イシュー（Issue）作成

作業テーマに対するイシューを作成する。

**MCPツール使用例:**
```
mcp__github__issue_write を使用
- method: create
- owner: AutoFor
- repo: uipath-xaml-visualizer
- title: [作業テーマを記載]
- body: [作業の目的や背景を記載]
```

**gh コマンド例:**
```bash
gh issue create --title "XAMLビジュアライザーの表示改善" --body "背景と目的"
```

**Issue作成時のポイント:**
- タイトルは作業テーマを明確に
- 本文には目的、背景、期待される成果を記載

### 3. PR と Issue を紐づけ

PR の本文に `Closes #イシュー番号` を追加して、PR と Issue を関連付ける。

**MCPツール使用例:**
```
mcp__github__update_pull_request を使用
- owner: AutoFor
- repo: uipath-xaml-visualizer
- pullNumber: [PR番号]
- body: "変更内容...\n\nCloses #[Issue番号]"
```

**gh コマンド例:**
```bash
gh pr edit <PR番号> --body "変更内容

Closes #<Issue番号>"
```

**紐付けのメリット:**
- PR がマージされると Issue が自動でクローズされる
- 変更履歴と課題が明確に関連付けられる

### 4. ユーザーに確認を依頼

**以下の確認文をユーザーに提示する:**

```
作業完了フローを実行しました：

📋 プルリクエスト: #[PR番号]
🎯 イシュー: #[Issue番号]

以下の内容をご確認ください：
- PR のタイトルと本文は適切か？
- Issue の内容は正確か？
- PR と Issue の紐付けは正しいか？

問題なければ、PR の承認とマージを行います。
よろしいですか？
```

**ユーザーの承認を待つこと。**

### 5. PR 承認とマージ（ユーザー承認後のみ）

ユーザーの承認を得てから、PR をマージする。

**MCPツール使用例:**
```
mcp__github__merge_pull_request を使用
- owner: AutoFor
- repo: uipath-xaml-visualizer
- pullNumber: [PR番号]
- merge_method: squash  # または merge, rebase
```

**gh コマンド例:**
```bash
gh pr merge <PR番号> --squash  # または --merge, --rebase
```

**マージ方法の選択:**
- `--squash`: 複数コミットを1つにまとめる（推奨）
- `--merge`: マージコミットを作成
- `--rebase`: コミット履歴を線形に保つ

### 6. Issue クローズ

PR に `Closes #XX` が含まれていれば自動でクローズされるが、念のため確認する。

**手動クローズが必要な場合:**
```bash
gh issue close <Issue番号>
```

### 7. master ブランチに戻る

作業ブランチから master ブランチに戻る。

```bash
cd ../uipath-github-xaml-visualizer  # メインリポジトリに戻る（Worktree使用時）
git checkout master
```

### 8. リモートの最新状態を取得と不要ブランチ削除

master ブランチを最新に更新し、不要なリモートブランチ情報を削除する。

```bash
git pull
git fetch --prune
```

### 9. Worktree の削除（Worktree使用時のみ）

Git Worktree を使用していた場合、作業ディレクトリを削除する。

```bash
git worktree remove ../uipath-xaml-visualizer-<ブランチ種別>
```

**例:**
```bash
git worktree remove ../uipath-xaml-visualizer-feature
```

## 完了フローの実行例

```bash
# 1. PRを作成
gh pr create --title "機能追加: XAMLビジュアライザー改善" --body "詳細な変更内容"
# 出力例: https://github.com/AutoFor/uipath-xaml-visualizer/pull/44

# 2. イシューを作成
gh issue create --title "XAMLビジュアライザーの表示改善" --body "背景と目的"
# 出力例: https://github.com/AutoFor/uipath-xaml-visualizer/issues/45

# 3. PRとイシューを紐づけ（PRの本文に追記）
gh pr edit 44 --body "変更内容

Closes #45"

# 4. ユーザーに確認
# → 「PRとイシューを確認してください。問題なければ承認します。」

# 5. PR承認とマージ（ユーザー承認後）
gh pr merge 44 --squash

# 6. Issueクローズ（通常は自動だが念のため）
gh issue close 45

# 7. masterブランチに戻る
git checkout master

# 8. 最新状態を取得と不要ブランチ削除
git pull
git fetch --prune

# 9. Worktreeを削除（使用時のみ）
git worktree remove ../uipath-xaml-visualizer-feature
```

## 注意事項

- **必ずユーザーの承認を得てから PR をマージする**
- PR と Issue の内容は慎重に確認する
- Worktree を削除する前にコミット・プッシュが完了しているか確認
- `git fetch --prune` でリモートで削除されたブランチをローカルからも削除

## よくある質問

**Q: PR と Issue はどちらを先に作るべきか？**
A: PR を先に作成してから Issue を作成し、PR に `Closes #XX` で紐付けます。

**Q: マージ方法は何を選ぶべきか？**
A: 基本的には `--squash` を使用して、コミット履歴を整理します。

**Q: Worktree を削除し忘れたらどうなるか？**
A: `git worktree list` で確認し、`git worktree remove` で削除できます。