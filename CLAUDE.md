# UiPath XAML Visualizer プロジェクトルール

## 🔒 Git ブランチ運用ルール

### ⚠️ masterブランチでの直接作業禁止
- **masterブランチで直接コード修正を行わない**
- 改修作業を開始する前に、必ず新しいブランチを作成する
- ブランチ名の命名規則: `feature/機能名` または `fix/修正内容`

### 作業フロー

1. **Git Worktree でブランチ作成**
   ```bash
   git worktree add ../uipath-xaml-visualizer-feature feature/機能名
   # または
   git worktree add ../uipath-xaml-visualizer-fix fix/修正内容
   ```
   - メインリポジトリと同じ階層に新しいディレクトリが作成される
   - 新しいブランチが自動的に作成され、そのブランチにチェックアウトされる
   - Worktree ディレクトリ名の命名規則: `uipath-xaml-visualizer-{ブランチ名}`

2. **Worktree ディレクトリに移動**
   ```bash
   cd ../uipath-xaml-visualizer-feature
   ```

3. **コード修正**: 新しいWorktree内で作業

4. **コミット**: 変更をコミット

5. **プッシュ**: リモートリポジトリにプッシュ
   ```bash
   git push -u origin feature/機能名
   ```

6. **プルリクエスト**: masterブランチへのマージはPR経由で行う

7. **作業完了後、メインリポジトリに戻る**
   ```bash
   cd ../uipath-github-xaml-visualizer
   ```

8. **Worktree を削除**（PR マージ後）
   ```bash
   git worktree remove ../uipath-xaml-visualizer-feature
   ```

9. **Worktree 一覧を確認**（必要に応じて）
   ```bash
   git worktree list
   ```

#### Worktree のメリット
- ブランチ切り替え時のファイル変更が不要
- ビルドやnode_modules再構築が不要
- 緊急対応が入っても作業中のコードを退避する必要がない
- 複数の作業を並行して進められる

#### 注意事項
- Worktreeを削除する前にコミット・プッシュを忘れずに
- `.git` フォルダは元のリポジトリで共有される
- PRマージ後は忘れずにWorktreeを削除する

### 例外
- ドキュメントの軽微な修正（README.md、CLAUDE.mdなど）は通常の `git checkout -b` でも可
- 設定ファイルの更新（.claude/settings.local.jsonなど）は通常の `git checkout -b` でも可

---

## 📋 GitHub運用ルール

### 作業完了後の必須手順（テーマ完了時）

作業（テーマ）が完了したら、**必ず以下の順序で実行**する：

1. **プルリクエスト作成**
   - `gh pr create` コマンドでPRを作成
   - タイトル: 作業内容を簡潔に記載
   - 本文: 変更内容の詳細を記載

2. **イシュー作成**
   - `gh issue create` コマンドでイシューを作成
   - タイトル: 作業テーマを記載
   - 本文: 作業の目的や背景を記載

3. **PRとイシューを紐づけ**
   - PRの本文に `Closes #イシュー番号` を追加
   - `gh pr edit <PR番号> --body` で編集

4. **ユーザーに確認を依頼**
   - PRとイシューの内容に問題がないか確認を求める
   - ユーザーの承認を待つ

5. **PR承認とマージ**（ユーザー承認後）
   ```bash
   gh pr merge <PR番号> --squash  # または --merge, --rebase
   ```

6. **イシュークローズ**
   ```bash
   gh issue close <イシュー番号>
   ```
   - 注意: PRに `Closes #XX` が含まれていれば自動でクローズされる

7. **masterブランチに戻る**
   ```bash
   git checkout master
   ```

8. **リモートの最新状態を取得と不要ブランチ削除**
   ```bash
   git pull
   git fetch --prune
   ```

### 完了フローの例
```bash
# 1. PRを作成
gh pr create --title "機能追加: XAMLビジュアライザー改善" --body "詳細な変更内容"
# 出力例: https://github.com/AutoFor/uipath-xaml-visualizer/pull/44

# 2. イシューを作成
gh issue create --title "XAMLビジュアライザーの表示改善" --body "背景と目的"
# 出力例: https://github.com/AutoFor/uipath-xaml-visualizer/issues/45

# 3. PRとイシューを紐づけ（PRの本文に追記）
gh pr edit 44 --body "変更内容\n\nCloses #45"

# 4. ユーザーに確認
# → Claudeがユーザーに「PRとイシューを確認してください。問題なければ承認します。」と聞く

# 5. PR承認とマージ（ユーザー承認後）
gh pr merge 44 --squash

# 6. イシュークローズ（通常は自動だが念のため）
gh issue close 45

# 7. masterブランチに戻る
git checkout master

# 8. 最新状態を取得と不要ブランチ削除
git pull
git fetch --prune
```

---

## 💻 開発ルール

### コーディング規約
- TypeScript/JavaScriptコードには日本語コメントを追加
- 初心者にも理解できる平易な説明を心がける

### ファイル構造
```
uipath-github-xaml-visualizer/
├── docs/              # ドキュメント
├── src/               # ソースコード
│   ├── extension/    # VSCode拡張機能
│   └── server/       # プレビューサーバー
├── CLAUDE.md         # プロジェクトルール
└── README.md         # プロジェクト説明
```
