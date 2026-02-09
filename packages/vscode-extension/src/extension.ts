import * as vscode from 'vscode'; // VSCode API
import { VisualizerPanel } from './visualizerPanel'; // ビジュアライザーパネル
import { DiffPanel } from './diffPanel'; // 差分表示パネル

/**
 * 拡張機能のアクティベーション時に呼ばれる関数
 */
export function activate(context: vscode.ExtensionContext) {
	const activateTime = new Date().toISOString();
	console.log(`[${activateTime}] [Extension] UiPath XAML Visualizer がアクティベートされました`); // ログ出力

	// ビジュアライザーを開くコマンドを登録
	const openVisualizerCommand = vscode.commands.registerCommand(
		'uipath-xaml-visualizer.openVisualizer',
		() => {
			console.log(`[${new Date().toISOString()}] [Extension] openVisualizer コマンド実行`);

			const editor = vscode.window.activeTextEditor; // アクティブなエディタを取得
			if (!editor) {
				console.error(`[${new Date().toISOString()}] [Extension ERROR] アクティブなエディタがありません`);
				vscode.window.showErrorMessage('アクティブなエディタがありません'); // エラー表示
				return;
			}

			const document = editor.document; // ドキュメントを取得
			console.log(`[${new Date().toISOString()}] [Extension] ドキュメント取得: ${document.fileName}`);

			if (!document.fileName.endsWith('.xaml')) {
				console.warn(`[${new Date().toISOString()}] [Extension WARN] XAMLファイルではありません: ${document.fileName}`);
				vscode.window.showWarningMessage('XAMLファイルではありません'); // 警告表示
				return;
			}

			// ビジュアライザーパネルを表示
			console.log(`[${new Date().toISOString()}] [Extension] ビジュアライザーパネルを表示`);
			VisualizerPanel.createOrShow(context.extensionUri, document);
		}
	);

	// 差分表示コマンドを登録
	const showDiffCommand = vscode.commands.registerCommand(
		'uipath-xaml-visualizer.showDiff',
		async (uri: vscode.Uri) => {
			if (!uri) {
				vscode.window.showErrorMessage('ファイルが選択されていません'); // エラー表示
				return;
			}

			// Git拡張機能を取得
			const gitExtension = vscode.extensions.getExtension('vscode.git');
			if (!gitExtension) {
				vscode.window.showErrorMessage('Git拡張機能が見つかりません'); // エラー表示
				return;
			}

			const git = gitExtension.exports.getAPI(1); // Git API取得
			const repo = git.repositories[0]; // 最初のリポジトリを取得

			if (!repo) {
				vscode.window.showErrorMessage('Gitリポジトリが見つかりません'); // エラー表示
				return;
			}

			// 差分パネルを表示
			DiffPanel.createOrShow(context.extensionUri, uri, repo);
		}
	);

	// 自動オープン機能
	const config = vscode.workspace.getConfiguration('uipathXamlVisualizer'); // 設定取得
	if (config.get('autoOpen')) {
		// XAMLファイルを開いたときの処理を登録
		vscode.window.onDidChangeActiveTextEditor((editor) => {
			if (editor && editor.document.fileName.endsWith('.xaml')) {
				vscode.commands.executeCommand('uipath-xaml-visualizer.openVisualizer'); // コマンド実行
			}
		});
	}

	// コマンドをコンテキストに追加
	context.subscriptions.push(openVisualizerCommand);
	context.subscriptions.push(showDiffCommand);
}

/**
 * 拡張機能の非アクティベーション時に呼ばれる関数
 */
export function deactivate() {
	console.log('UiPath XAML Visualizer が非アクティベートされました'); // ログ出力
}
