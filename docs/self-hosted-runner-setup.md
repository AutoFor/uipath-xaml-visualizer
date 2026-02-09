# GitHub Actions Self-hosted Runner セットアップガイド

## 概要

このドキュメントでは、ローカルWindows環境でGitHub Actions Self-hosted Runnerを設定する手順を説明します。

## 前提条件

- Windows 10/11
- 管理者権限
- インターネット接続
- GitHubアカウント（リポジトリへのAdmin権限）

## 必要なソフトウェア

### 1. Node.js v20のインストール

```powershell
# wingetを使用してインストール
winget install OpenJS.NodeJS.LTS

# バージョン確認
node --version
npm --version
```

### 2. Git for Windowsのインストール

```powershell
# wingetを使用してインストール
winget install Git.Git

# バージョン確認
git --version
```

## Self-hosted Runnerのセットアップ

### ステップ1: GitHubリポジトリでRunnerを追加

1. GitHubリポジトリにアクセス: https://github.com/AutoFor/uipath-xaml-visualizer
2. **Settings** → **Actions** → **Runners** → **New self-hosted runner** をクリック
3. **Runner image**: `Windows` を選択
4. **Architecture**: `x64` を選択

### ステップ2: ローカルWindowsにRunnerをインストール

管理者権限でPowerShellを開き、以下のコマンドを実行します：

```powershell
# 1. Runnerディレクトリ作成
mkdir C:\actions-runner
cd C:\actions-runner

# 2. Runnerダウンロード（GitHubページに表示されるURLを使用）
# 例：
Invoke-WebRequest -Uri https://github.com/actions/runner/releases/download/v2.321.0/actions-runner-win-x64-2.321.0.zip -OutFile actions-runner-win-x64.zip

# 3. ZIP解凍
if((Get-FileHash -Path actions-runner-win-x64.zip -Algorithm SHA256).Hash.ToUpper() -ne '実際のSHA256ハッシュ値'.ToUpper()) {
    throw 'Computed checksum did not match'
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory("$PWD/actions-runner-win-x64.zip", "$PWD")
```

### ステップ3: Runnerの設定

```powershell
# 4. Runner設定（GitHubページに表示されるトークンを使用）
.\config.cmd --url https://github.com/AutoFor/uipath-xaml-visualizer --token <YOUR_TOKEN>

# 設定時の入力項目：
# - runner group: [Enter]でデフォルト
# - runner name: [Enter]でホスト名を使用、またはカスタム名を入力
# - runner labels: [Enter]でデフォルト、または追加ラベルを入力
# - work folder: [Enter]でデフォルト (_work)
```

### ステップ4: Windowsサービスとして登録（推奨）

Runnerを常時起動するため、Windowsサービスとして登録します：

```powershell
# サービスとしてインストール（管理者権限必須）
.\svc.cmd install

# サービス開始
.\svc.cmd start

# サービス状態確認
.\svc.cmd status
```

**または、サービス化せずに実行（開発・テスト用）:**

```powershell
# フォアグラウンドで実行
.\run.cmd
```

## 動作確認

### 1. Runnerの状態確認

GitHubリポジトリの **Settings** → **Actions** → **Runners** で、Runnerが **Idle** 状態になっていることを確認します。

### 2. テストワークフローの実行

```powershell
# リポジトリで任意の変更をコミット＆プッシュ
cd C:\prj\uipath-github-xaml-visualizer
git add .
git commit -m "test: Self-hosted Runnerのテスト"
git push origin <your-branch>
```

GitHubの **Actions** タブでワークフローが実行されることを確認します。

## トラブルシューティング

### Runnerが起動しない場合

```powershell
# ログ確認
Get-Content C:\actions-runner\_diag\Runner_*.log -Tail 50
```

### サービスが起動しない場合

```powershell
# サービス状態確認
Get-Service actions.runner.*

# サービス再起動
.\svc.cmd stop
.\svc.cmd start
```

### ポート8080が使用中の場合

```powershell
# ポート8080を使用しているプロセスを確認
netstat -ano | findstr :8080

# プロセスID確認後、終了
Stop-Process -Id <PID> -Force
```

## メンテナンス

### Runnerの更新

```powershell
# サービス停止
.\svc.cmd stop

# 最新バージョンをダウンロード＆解凍（上記手順2を参照）

# サービス再起動
.\svc.cmd start
```

### Runnerの削除

```powershell
# サービス停止＆アンインストール
.\svc.cmd stop
.\svc.cmd uninstall

# Runner登録解除
.\config.cmd remove --token <YOUR_TOKEN>
```

## セキュリティ考慮事項

- ✅ Runnerは信頼できる環境で実行してください
- ✅ ファイアウォール設定を確認してください
- ✅ GitHubトークンは安全に管理してください
- ✅ 定期的にRunnerを更新してください
- ⚠️ 公開リポジトリでSelf-hosted Runnerを使用する場合は、Pull Requestからの実行を制限することを検討してください

## 参考リソース

- [GitHub Actions Self-hosted runners 公式ドキュメント](https://docs.github.com/en/actions/hosting-your-own-runners)
- [Windows用Self-hosted runnerセットアップガイド](https://docs.github.com/en/actions/hosting-your-own-runners/adding-self-hosted-runners)
- [Self-hosted runnerのセキュリティガイド](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/about-self-hosted-runners#self-hosted-runner-security)
