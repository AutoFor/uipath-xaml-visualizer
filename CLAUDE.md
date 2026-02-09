# UiPath XAML Visualizer プロジェクトルール

## 🔒 Git ブランチ運用ルール

### ⚠️ masterブランチでの直接作業禁止
- **masterブランチで直接コード修正を行わない**
- 改修作業を開始する前に、必ず新しいブランチを作成する
- ブランチ名の命名規則: `feature/機能名` または `fix/修正内容`

### 作業フロー
1. **ブランチ作成**: `git checkout -b feature/xxx` または `git checkout -b fix/xxx`
2. **コード修正**: 新しいブランチ上で作業
3. **コミット**: 変更をコミット
4. **プッシュ**: リモートリポジトリにプッシュ
5. **プルリクエスト**: masterブランチへのマージはPR経由で行う

### 例外
- ドキュメントの軽微な修正（README.md、CLAUDE.mdなど）
- 設定ファイルの更新（.claude/settings.local.jsonなど）

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

# 2. イシューを作成
gh issue create --title "XAMLビジュアライザーの表示改善" --body "背景と目的"

# 3. PRとイシューを紐づけ（PRの本文に追記）
gh pr edit <PR番号> --body "変更内容\n\nCloses #<イシュー番号>"

# 4. masterブランチに戻る
git checkout master

# 5. 最新状態を取得
git fetch
git pull
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
