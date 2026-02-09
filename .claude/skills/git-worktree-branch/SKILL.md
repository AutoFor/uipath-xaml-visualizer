---
name: git-worktree-branch
description: UiPath XAML Visualizer プロジェクトで新しい作業を開始するときの Git ブランチ運用。ユーザーが「新しい機能を追加したい」「バグを修正したい」「作業を開始したい」「ブランチを作成したい」と言ったときに使用します。
disable-model-invocation: false
user-invocable: true
allowed-tools:
  - Bash
  - Read
---

# Git Worktree ブランチ運用スキル

このスキルは、`uipath-github-xaml-visualizer` プロジェクトで新しい作業を開始するときの標準手順を提供します。

## ⚠️ 重要な禁止事項

- **master ブランチで直接コード修正を行わない**
- **master ブランチで `git commit` や `git push` を提案しない**
- 改修作業を開始する前に、必ず新しいブランチを作成する

## 作業開始手順

### 1. 作業内容の確認

ユーザーに以下を確認する：
- 今回の作業内容は何か？
- 機能追加なのか、バグ修正なのか？

### 2. ブランチ名の提案

作業内容に応じて、以下の命名規則でブランチ名を1つ提案する：

- 機能追加の場合: `feature/機能名`
  - 例: `feature/add-xaml-preview`, `feature/improve-parser`
- バグ修正の場合: `fix/修正内容`
  - 例: `fix/parse-error`, `fix/display-issue`

### 3. Git Worktree コマンドの提案

以下の形式で `git worktree add` コマンドを提案する：

```bash
git worktree add ../uipath-xaml-visualizer-<ブランチ種別> <ブランチ名>
```

**具体例:**
```bash
# 機能追加の場合
git worktree add ../uipath-xaml-visualizer-feature feature/add-xaml-preview

# バグ修正の場合
git worktree add ../uipath-xaml-visualizer-fix fix/parse-error
```

**Worktree の仕組み説明:**
- メインリポジトリと同じ階層に新しいディレクトリが作成される
- 新しいブランチが自動的に作成され、そのブランチにチェックアウトされる
- Worktree ディレクトリ名: `uipath-xaml-visualizer-{ブランチ種別}`

### 4. 作業ディレクトリへの移動

Worktree ディレクトリへの移動コマンドを提案する：

```bash
cd ../uipath-xaml-visualizer-<ブランチ種別>
```

### 5. 作業完了後の手順を案内

作業完了後に必要な手順を必ず案内する：

1. **コミット**: 変更をコミット
2. **プッシュ**: リモートリポジトリにプッシュ
   ```bash
   git push -u origin <ブランチ名>
   ```
3. **PR 作成**: GitHub でプルリクエストを作成（`/github-finish` スキルを使用）
4. **Issue 作成と紐付け**: PR と Issue を関連付け
5. **Worktree 削除**: PR マージ後にWorktreeを削除
   ```bash
   # メインリポジトリに戻る
   cd ../uipath-github-xaml-visualizer

   # Worktree を削除
   git worktree remove ../uipath-xaml-visualizer-<ブランチ種別>
   ```

## Worktree のメリット

ユーザーに以下のメリットを説明する：

- ✅ ブランチ切り替え時のファイル変更が不要
- ✅ ビルドや node_modules 再構築が不要
- ✅ 緊急対応が入っても作業中のコードを退避する必要がない
- ✅ 複数の作業を並行して進められる

## 注意事項

- Worktreeを削除する前にコミット・プッシュを忘れずに行う
- `.git` フォルダは元のリポジトリで共有される
- PRマージ後は忘れずにWorktreeを削除する

## 例外: Worktree を使わなくてもよいケース

以下の場合は通常の `git checkout -b` でも可：
- ドキュメントの軽微な修正（README.md、CLAUDE.mdなど）
- 設定ファイルの更新（.claude/settings.local.jsonなど）

## Worktree 一覧の確認

必要に応じて、以下のコマンドで現在のWorktree一覧を確認できることを案内する：

```bash
git worktree list
```