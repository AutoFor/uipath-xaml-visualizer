---
name: dev-build
description: 開発ビルドを実行し、Windows固定パスにChrome拡張機能を出力する。実装が完了したら自動で実行します。
disable-model-invocation: false
user-invocable: true
allowed-tools:
  - Bash
---

# 開発ビルドスキル

実装完了後にChrome拡張機能の開発ビルドを実行し、Windows固定パスに出力する。

## 重要: 作業ディレクトリの原則

**すべてのコマンドは現在の作業ディレクトリ（カレントディレクトリ）から実行すること。**
メインリポジトリではなく、Worktree 上にいる場合はその Worktree ディレクトリを基準にする。

## 実行手順

以下のコマンドを順番に実行する:

### 1. ブランチ確認

まず現在のブランチを確認する:

```bash
git branch --show-current
```

表示されたブランチ名が期待するブランチと一致することを確認する。
もし Worktree 上で作業しているはずなのに `master` と表示された場合、**実行ディレクトリが間違っている**ので、正しい Worktree ディレクトリに移動してから再実行すること。

### 2. ビルド

```bash
npm run build:shared && (cd packages/github-extension && npx webpack --mode development)
```

- `npm run build:shared` はプロジェクトルート（現在のディレクトリ）から実行
- `npx webpack` はサブシェル内で `cd packages/github-extension` してから実行（CWD を変更しない）

**注意**: `npm run dev:github` はwatchモードのため、スキルでは `npx webpack --mode development` を直接実行して1回だけビルドする。

### 3. ビルド結果の確認

ビルド成功後、webpackログに表示される以下の情報を確認する:
- `branch:` が手順1で確認したブランチ名と一致すること
- `output:` のパスにブランチ名が含まれていること（master 以外の場合）

### 4. 出力先パスをクリップボードにコピー

webpackログから出力先の WSL パスを取得し、Windows パスに変換してクリップボードにコピーする:

```bash
wslpath -w "<WSLパス>" | clip.exe
```

コピー後、以下のメッセージをユーザーに表示する:

```
ブランチ: <ブランチ名>
出力先パスをクリップボードにコピーしました: <Windowsパス>
Chromeで chrome://extensions を開き「パッケージ化されていない拡張機能を読み込む」でパスを貼り付けてください。
（既に登録済みの場合はビルドだけで自動反映されます）
```

## 実行タイミング

- コードの実装が完了した後
- Chrome拡張機能の動作確認をしたい時
- `/dev-build` で手動実行
