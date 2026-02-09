import * as vscode from 'vscode'; // VSCode API
import { parseXaml, calculateDiff, renderDiff } from '@uipath-xaml-visualizer/shared'; // 共通ライブラリ

/**
 * XAML差分表示パネルを管理するクラス
 */
export class DiffPanel {
	public static currentPanel: DiffPanel | undefined; // 現在のパネルインスタンス
	private readonly _panel: vscode.WebviewPanel; // Webviewパネル
	private readonly _extensionUri: vscode.Uri; // 拡張機能のURI
	private _disposables: vscode.Disposable[] = []; // リソース解放用

	/**
	 * パネルを作成または既存のパネルを表示
	 */
	public static createOrShow(extensionUri: vscode.Uri, fileUri: vscode.Uri, repo: any) {
		const column = vscode.ViewColumn.Beside; // エディタの横に表示

		// 既存のパネルがあれば表示
		if (DiffPanel.currentPanel) {
			DiffPanel.currentPanel._panel.reveal(column);
			DiffPanel.currentPanel._update(fileUri, repo);
			return;
		}

		// 新しいパネルを作成
		const panel = vscode.window.createWebviewPanel(
			'uipathXamlDiff', // パネルID
			'UiPath XAML Diff', // パネルタイトル
			column, // 表示位置
			{
				enableScripts: true, // JavaScriptを有効化
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')] // リソースルート
			}
		);

		DiffPanel.currentPanel = new DiffPanel(panel, extensionUri, fileUri, repo);
	}

	/**
	 * コンストラクタ（プライベート）
	 */
	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, fileUri: vscode.Uri, repo: any) {
		this._panel = panel;
		this._extensionUri = extensionUri;

		// 初期コンテンツを設定
		this._update(fileUri, repo);

		// パネルが閉じられたときの処理
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
	}

	/**
	 * リソースを解放
	 */
	public dispose() {
		DiffPanel.currentPanel = undefined;

		this._panel.dispose(); // パネルを破棄

		while (this._disposables.length) {
			const disposable = this._disposables.pop();
			if (disposable) {
				disposable.dispose(); // リソースを解放
			}
		}
	}

	/**
	 * パネルのコンテンツを更新
	 */
	private async _update(fileUri: vscode.Uri, repo: any) {
		const webview = this._panel.webview;

		try {
			// Gitから現在のファイルとHEADのファイルを取得
			const currentContent = await vscode.workspace.fs.readFile(fileUri); // 現在のファイル
			const currentXaml = Buffer.from(currentContent).toString('utf8'); // UTF-8に変換

			// HEADのファイル内容を取得（仮実装）
			const headContent = await this._getHeadContent(fileUri, repo); // HEADの内容
			const headXaml = headContent || ''; // 空文字列の場合は空

			// XAML解析
			const currentData = parseXaml(currentXaml); // 現在のXAML
			const headData = headXaml ? parseXaml(headXaml) : null; // HEADのXAML

			// 差分計算
			const diffResult = headData ? calculateDiff(headData, currentData) : null; // 差分

			// HTMLを生成
			this._panel.webview.html = this._getHtmlForWebview(webview, diffResult);
		} catch (error) {
			// エラーが発生した場合
			const errorMessage = error instanceof Error ? error.message : String(error);
			this._panel.webview.html = this._getErrorHtml(errorMessage);
		}
	}

	/**
	 * HEADのファイル内容を取得
	 */
	private async _getHeadContent(fileUri: vscode.Uri, repo: any): Promise<string | null> {
		try {
			// Git APIを使ってHEADの内容を取得（仮実装）
			// 実際のGit API呼び出しは後で実装
			return null; // 仮の実装
		} catch (error) {
			console.error('HEADの内容取得エラー:', error); // エラーログ
			return null;
		}
	}

	/**
	 * Webview用のHTMLを生成
	 */
	private _getHtmlForWebview(webview: vscode.Webview, diffResult: any): string {
		return `<!DOCTYPE html>
		<html lang="ja">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>UiPath XAML Diff</title>
			<style>
				body { font-family: Arial, sans-serif; padding: 20px; }
				.added { background-color: #d4edda; }
				.removed { background-color: #f8d7da; }
				.modified { background-color: #fff3cd; }
			</style>
		</head>
		<body>
			<h1>UiPath XAML Diff</h1>
			<div id="diff">
				<pre>${JSON.stringify(diffResult, null, 2)}</pre>
			</div>
		</body>
		</html>`;
	}

	/**
	 * エラー表示用のHTMLを生成
	 */
	private _getErrorHtml(errorMessage: string): string {
		return `<!DOCTYPE html>
		<html lang="ja">
		<head>
			<meta charset="UTF-8">
			<title>Error</title>
		</head>
		<body>
			<h1>エラーが発生しました</h1>
			<pre>${errorMessage}</pre>
		</body>
		</html>`;
	}
}
