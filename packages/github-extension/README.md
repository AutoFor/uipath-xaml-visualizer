# UiPath XAML Visualizer for GitHub（Chrome拡張機能）

GitHub上でUiPath XAMLファイルを視覚的に表示するChrome拡張機能です。

---

## インストール方法

Chrome Web Store には未公開のため、ローカルでビルドして手動インストールします。

### 前提条件

- Node.js 20.x 以上
- npm 9.x 以上

### 手順

1. リポジトリをクローン（まだの場合）

```bash
git clone https://github.com/AutoFor/uipath-xaml-visualizer.git
cd uipath-xaml-visualizer
```

2. 依存関係をインストール

```bash
npm install
```

3. ビルド

```bash
npm run build:shared    # 共通ライブラリをビルド
npm run build:github    # GitHub拡張機能をビルド
```

ビルドが成功すると `packages/github-extension/dist/` フォルダが生成されます。

4. Chromeのアドレスバーに `chrome://extensions` と入力してEnter
5. 画面右上の **「デベロッパーモード」** のスイッチをONにする
6. 左上に表示される **「パッケージ化されていない拡張機能を読み込む」** をクリック
7. `packages/github-extension/dist/` フォルダを選択
8. 拡張機能一覧に「UiPath XAML Visualizer for GitHub」が表示されたら完了

---

## 更新方法

1. 最新のコードを取得してビルド

```bash
git pull
npm run build:shared
npm run build:github
```

2. Chromeで `chrome://extensions` を開く
3. 「UiPath XAML Visualizer for GitHub」の **リロードボタン（🔄）** をクリック

> **ポイント:** フォルダの再選択は不要です。初回に指定したフォルダをChromeが覚えているので、中身を更新してリロードするだけでOKです。

---

## よくある質問

### Q: デベロッパーモードの警告が出ます

「デベロッパーモードの拡張機能を無効にする」というポップアップが起動時に表示されることがあります。
**「×」で閉じれば問題ありません。** Chrome Web Storeに公開されるまではこの警告が出ます。

### Q: Chrome以外のブラウザでも使えますか？

Manifest V3 対応のブラウザであれば同じ手順で使えます。

| ブラウザ | 拡張機能管理ページ |
|---------|-----------------|
| Chrome | `chrome://extensions` |
| Edge | `edge://extensions` |
| Brave | `brave://extensions` |

### Q: 自動更新はされますか？

**されません。** 更新があるたびに上記の「更新方法」を手動で行う必要があります。
Chrome Web Storeに公開されると自動更新になります。

### Q: フォルダを移動・削除してしまいました

拡張機能が無効になります。もう一度「パッケージ化されていない拡張機能を読み込む」からやり直してください。

---

## 開発コマンド

```bash
# 開発モード（ファイル変更時に自動リビルド）
npm run dev:github

# 本番ビルド
npm run build:shared && npm run build:github

# 拡張機能のパッケージング（zip作成）
cd packages/github-extension
npx web-ext build --source-dir=dist --overwrite-dest
```
