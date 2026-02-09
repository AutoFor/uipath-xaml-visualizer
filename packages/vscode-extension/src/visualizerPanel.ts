import * as vscode from 'vscode'; // VSCode API
import * as path from 'path'; // パス操作
import { XamlParser, SequenceRenderer, TreeViewRenderer } from '@uipath-xaml-visualizer/shared'; // 共通ライブラリ

/**
 * XAMLビジュアライザーパネルを管理するクラス
 */
export class VisualizerPanel {
	public static currentPanel: VisualizerPanel | undefined; // 現在のパネルインスタンス
	private readonly _panel: vscode.WebviewPanel; // Webviewパネル
	private readonly _extensionUri: vscode.Uri; // 拡張機能のURI
	private _disposables: vscode.Disposable[] = []; // リソース解放用

	/**
	 * パネルを作成または既存のパネルを表示
	 */
	public static createOrShow(extensionUri: vscode.Uri, document: vscode.TextDocument) {
		const column = vscode.ViewColumn.Beside; // エディタの横に表示

		// 既存のパネルがあれば表示
		if (VisualizerPanel.currentPanel) {
			VisualizerPanel.currentPanel._panel.reveal(column);
			VisualizerPanel.currentPanel._update(document);
			return;
		}

		// 新しいパネルを作成
		const panel = vscode.window.createWebviewPanel(
			'uipathXamlVisualizer', // パネルID
			'UiPath XAML Visualizer', // パネルタイトル
			column, // 表示位置
			{
				enableScripts: true, // JavaScriptを有効化
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')] // リソースルート
			}
		);

		VisualizerPanel.currentPanel = new VisualizerPanel(panel, extensionUri, document);
	}

	/**
	 * コンストラクタ（プライベート）
	 */
	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, document: vscode.TextDocument) {
		this._panel = panel;
		this._extensionUri = extensionUri;

		// 初期コンテンツを設定
		this._update(document);

		// パネルが閉じられたときの処理
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// ドキュメントが変更されたときの処理
		vscode.workspace.onDidChangeTextDocument(
			(e) => {
				if (e.document === document) {
					this._update(document); // コンテンツを更新
				}
			},
			null,
			this._disposables
		);
	}

	/**
	 * リソースを解放
	 */
	public dispose() {
		VisualizerPanel.currentPanel = undefined;

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
	private _update(document: vscode.TextDocument) {
		const webview = this._panel.webview;

		try {
			// XAMLを解析
			const xamlContent = document.getText(); // ドキュメントの内容を取得
			const parser = new XamlParser();
			const workflowData = parser.parse(xamlContent); // XAML解析

			// HTMLを生成
			this._panel.webview.html = this._getHtmlForWebview(webview, workflowData);
		} catch (error) {
			// エラーが発生した場合
			const errorMessage = error instanceof Error ? error.message : String(error);
			this._panel.webview.html = this._getErrorHtml(errorMessage);
		}
	}

	/**
	 * Webview用のHTMLを生成
	 */
	private _getHtmlForWebview(webview: vscode.Webview, workflowData: any): string {
		// 仮のHTMLを返す（後で実装）
		return `<!DOCTYPE html>
		<html lang="ja">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>UiPath XAML Visualizer</title>
			<style>
				body { font-family: Arial, sans-serif; padding: 20px; }
				.activity { margin: 10px 0; padding: 10px; border: 1px solid #ccc; }
			</style>
		</head>
		<body>
			<h1>UiPath XAML Visualizer</h1>
			<div id="workflow">
				<pre>${JSON.stringify(workflowData, null, 2)}</pre>
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
