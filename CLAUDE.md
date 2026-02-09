# UiPath XAML Visualizer プロジェクトルール

## 📚 Claude Code Skills について

このプロジェクトでは、繰り返し実行される作業を **Claude Code Skills** として定義しています。

### 利用可能なスキル

| スキル名 | 説明 | 呼び出し方法 |
|---------|------|------------|
| `/git-worktree-branch` | Git Worktree を使った新規ブランチ作成 | 「新しい機能を追加したい」「作業を開始したい」 |
| `/github-finish` | 作業完了時の PR・Issue 作成フロー | 「作業が完了した」「PRを作成したい」 |
| `/japanese-comments` | TypeScript/JavaScript コードに日本語コメント追加 | 「コードを書いて」「実装して」 |

### スキルの場所

スキルは [.claude/skills/](.claude/skills/) ディレクトリに保存されています。

- [.claude/skills/git-worktree-branch/SKILL.md](.claude/skills/git-worktree-branch/SKILL.md)
- [.claude/skills/github-finish/SKILL.md](.claude/skills/github-finish/SKILL.md)
- [.claude/skills/japanese-comments/SKILL.md](.claude/skills/japanese-comments/SKILL.md)

## 🔒 Git ブランチ運用ルール（概要）

詳細は `/git-worktree-branch` スキルを参照してください。

### ⚠️ 重要な原則
- **masterブランチで直接コード修正を行わない**
- 改修作業を開始する前に、必ず新しいブランチを作成する
- ブランチ名の命名規則: `feature/機能名` または `fix/修正内容`

### 基本フロー

1. Git Worktree でブランチ作成
2. Worktree ディレクトリに移動
3. コード修正
4. コミット & プッシュ
5. プルリクエスト & Issue 作成
6. PR マージ後に Worktree 削除

**📌 詳細な手順は `/git-worktree-branch` スキルで確認できます。**

---

## 📋 GitHub運用ルール（概要）

詳細は `/github-finish` スキルを参照してください。

### 作業完了後の必須手順

作業（テーマ）が完了したら、以下の順序で実行：

1. プルリクエスト作成
2. イシュー作成
3. PR と Issue を紐づけ
4. ユーザーに確認を依頼
5. PR 承認とマージ（ユーザー承認後）
6. Issue クローズ
7. master ブランチに戻る
8. リモートの最新状態を取得

**📌 詳細な手順とコマンド例は `/github-finish` スキルで確認できます。**

---

## 💻 開発ルール（概要）

詳細は `/japanese-comments` スキルを参照してください。

### コーディング規約
- TypeScript/JavaScriptコードには日本語の行末コメントを追加
- 初心者にも理解できる平易な説明を心がける
- すべての重要な行にコメントを付ける

**📌 コメントの書き方とパターンは `/japanese-comments` スキルで確認できます。**

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
