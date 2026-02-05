# ローカルテスト手順

Azure DevOps Marketplaceに公開する前に、ローカル環境で拡張機能をテストする方法です。

## 方法1: ローカルHTMLプレビュー（推奨）

### 手順

1. **プロジェクトをビルド**
   ```bash
   npm run build
   ```

2. **ローカルWebサーバーを起動**
   ```bash
   npm run serve
   ```

3. **ブラウザでアクセス**
   ```
   http://localhost:8080/test/local-preview/viewer-test.html
   ```

4. **XAMLファイルを読み込み**
   - 右上のコントロールパネルからサンプルXAMLを選択
   - 「読み込み」ボタンをクリック
   - ビジュアル表示を確認

### テスト用サンプルファイル

- `test/fixtures/simple-sequence.xaml` - シンプルなSequenceワークフロー
- `test/fixtures/click-workflow.xaml` - UI操作を含むワークフロー

### 動作確認ポイント

✅ XAMLが正しくパースされている
✅ アクティビティカードが表示される
✅ ツリービューが正しく表示される
✅ 「Raw XML」⇔「Visual View」の切替が動作する
✅ ツリービューの折りたたみ/展開が動作する
✅ アクティビティクリックで詳細パネルが開く
✅ プロパティが正しく表示される

---

## 方法2: Azure DevOps Organization でテスト

### 前提条件

- Azure DevOps Organizationのアカウント（無料版でOK）
- Visual Studio Marketplaceのパブリッシャーアカウント

### 手順

1. **拡張機能パッケージを作成**
   ```bash
   npm run package
   ```
   → `uipath-xaml-visualizer.vsix` ファイルが生成される

2. **Azure DevOps Marketplaceにアップロード**
   - https://marketplace.visualstudio.com/manage にアクセス
   - パブリッシャーを作成（初回のみ）
   - 「New extension」から `.vsix` をアップロード
   - **「Share with」で自分のOrganizationのみに共有**（重要）

3. **自分のOrganizationにインストール**
   - Azure DevOps Organization にアクセス
   - Organization Settings → Extensions → Browse marketplace
   - インストールした拡張機能を検索してインストール

4. **リポジトリでテスト**
   - リポジトリに `.xaml` ファイルをコミット
   - ファイルを開いて拡張機能が動作するか確認

---

## 方法3: ブラウザ拡張機能として直接読み込み（開発用）

Chrome/Edgeの拡張機能として一時的に読み込んでテストすることもできます。

### 手順

1. **manifest.json を Chrome拡張用に変更**（一時的に）

2. **Chromeで拡張機能を読み込み**
   - `chrome://extensions/` を開く
   - 「デベロッパーモード」を有効化
   - 「パッケージ化されていない拡張機能を読み込む」
   - プロジェクトフォルダを選択

3. **Azure DevOpsでテスト**
   - Azure DevOps Reposにアクセス
   - `.xaml` ファイルを開く
   - 拡張機能が動作することを確認

---

## トラブルシューティング

### ❌ "CORS policy" エラーが出る

**原因**: ブラウザのセキュリティ制限により、`file://` プロトコルでのローカルファイル読み込みが制限されています。

**解決策**:
- 必ず `npm run serve` でWebサーバーを起動してください
- `http://localhost:8080` 経由でアクセスしてください

### ❌ モジュールが読み込めない

**原因**: ビルドが実行されていない、またはパスが間違っています。

**解決策**:
```bash
# 再ビルド
npm run build

# distフォルダが存在することを確認
ls dist/
```

### ❌ XAMLが表示されない

**原因**: XAMLのパースエラー、または不正なXAML構造です。

**解決策**:
- ブラウザの開発者ツール（F12）でコンソールエラーを確認
- サンプルXAMLファイルで動作するか確認
- XAML構造が正しいかチェック

---

## 次のステップ

ローカルテストで問題なければ:

1. ✅ `vss-extension.json` の `publisher` を自分のIDに変更
2. ✅ README、アイコン、スクリーンショットを追加
3. ✅ `npm run package` でパッケージ作成
4. ✅ Azure DevOps Marketplaceに公開（Private → Public）

---

## 参考リンク

- [Azure DevOps Extension 開発ガイド](https://learn.microsoft.com/en-us/azure/devops/extend/)
- [拡張機能のテスト](https://learn.microsoft.com/en-us/azure/devops/extend/test-publish-extensions)
