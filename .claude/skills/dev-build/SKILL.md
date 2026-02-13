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

## 実行手順

以下のコマンドを順番に実行する:

### 1. ビルド

```bash
npm run build:shared && npx webpack --mode development
```

`npx webpack` はプロジェクトルートではなく `packages/github-extension/` ディレクトリで実行すること。

**注意**: `npm run dev:github` はwatchモードのため、スキルでは `npx webpack --mode development` を直接実行して1回だけビルドする。

### 2. 出力先パスをクリップボードにコピー

ビルド成功後、webpackログから出力先の WSL パスを取得し、Windows パスに変換してクリップボードにコピーする:

```bash
wslpath -w "<WSLパス>" | clip.exe
```

コピー後、以下のメッセージをユーザーに表示する:

```
出力先パスをクリップボードにコピーしました: <Windowsパス>
Chromeで chrome://extensions を開き「パッケージ化されていない拡張機能を読み込む」でパスを貼り付けてください。
（既に登録済みの場合はビルドだけで自動反映されます）
```

## 実行タイミング

- コードの実装が完了した後
- Chrome拡張機能の動作確認をしたい時
- `/dev-build` で手動実行
