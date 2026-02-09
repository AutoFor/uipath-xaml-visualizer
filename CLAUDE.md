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
